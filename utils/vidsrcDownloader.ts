const DEFAULT_API_BASE = "https://vidsrc-scraper-serverless.vercel.app";
const FFMPEG_PACKAGE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
const FFMPEG_PACKAGE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm";
const FFMPEG_UTIL_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";
const FFMPEG_CORE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const MUX_JS_URL = "https://cdn.jsdelivr.net/npm/mux.js@6.3.0/dist/mux.min.js";
const LOG_PREFIX = "[ImpactStream Download]";

type MediaType = "movie" | "tv";
type ExtractResult = { hls_url?: string | null; error?: string | null };
type ExtractResponse = { success?: boolean; error?: string; results?: Record<string, ExtractResult> };
type FFmpegInstance = {
  load: (config: { coreURL: string; wasmURL: string; classWorkerURL: string }) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array | string>;
  exec: (args: string[]) => Promise<number>;
  terminate: () => void;
};
type ProgressUpdate = {
  stage: "extracting" | "loading" | "downloading" | "converting" | "saving";
  message: string;
  progress: number;
};
type MuxSegment = { initSegment?: Uint8Array; data?: Uint8Array };
type MuxTransmuxer = {
  on: (event: string, callback: (segment?: MuxSegment) => void) => void;
  off?: (event: string, callback: (segment?: MuxSegment) => void) => void;
  push: (data: Uint8Array) => void;
  flush: () => void;
  dispose?: () => void;
};
type MuxJs = { mp4: { Transmuxer: new (options?: Record<string, unknown>) => MuxTransmuxer } };

declare global {
  interface Window { muxjs?: MuxJs; }
}

export type VidsrcDownloadRequest = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  season?: number;
  episode?: number;
};
type DownloadOptions = { signal?: AbortSignal; onProgress?: (update: ProgressUpdate) => void };
type PlaylistFile = { name: string; url: string };
type MediaPart = { url: string; range?: string };
type FetchResult = {
  bytes: Uint8Array;
  status: number;
  contentType: string;
  contentLength: string | null;
};

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_VIDSRC_API_URL || DEFAULT_API_BASE).replace(/\/$/, "");
}

function createRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeUrlForLog(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split("?")[0];
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function bytePreview(bytes: Uint8Array, count = 16) {
  return Array.from(bytes.subarray(0, count)).map((value) => value.toString(16).padStart(2, "0")).join(" ");
}

function logDownload(runId: string, level: "log" | "warn" | "error", event: string, details: Record<string, unknown> = {}) {
  const payload = { runId, event, ...details };
  console[level](LOG_PREFIX, payload);
}

function sendServerDiagnostic(runId: string, event: string, details: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ runId, event, timestamp: new Date().toISOString(), ...details });
  void fetch("/api/download-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function segmentConcurrency() {
  if (isMobileDevice()) return 3;
  const cores = typeof navigator === "undefined" ? 6 : navigator.hardwareConcurrency || 6;
  return Math.max(4, Math.min(8, Math.ceil(cores / 2)));
}

function findStream(payload: ExtractResponse): string | null {
  for (const result of Object.values(payload.results || {})) {
    if (typeof result?.hls_url === "string" && result.hls_url.length > 0) return result.hls_url;
  }
  return null;
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Playlist request failed (${response.status}).`);
  return response.text();
}

function absoluteUrl(value: string, base: string): string {
  return new URL(value, base).toString();
}

async function selectMediaPlaylist(url: string, signal?: AbortSignal) {
  const manifest = await fetchText(url, signal);
  const lines = manifest.split(/\r?\n/);
  if (!lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"))) return { url, manifest };

  let best: { bandwidth: number; url: string } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidth = Number(lines[index].match(/BANDWIDTH=(\d+)/)?.[1] || 0);
    const uri = lines.slice(index + 1).find((line) => line && !line.startsWith("#"));
    if (uri && (!best || bandwidth > best.bandwidth)) best = { bandwidth, url: absoluteUrl(uri, url) };
  }
  if (!best) throw new Error("No playable HLS variant was found.");
  return { url: best.url, manifest: await fetchText(best.url, signal) };
}

function downloadName(input: VidsrcDownloadRequest): string {
  const suffix = input.mediaType === "tv"
    ? ` S${String(input.season || 1).padStart(2, "0")}E${String(input.episode || 1).padStart(2, "0")}`
    : "";
  return `${input.title}${suffix}`.replace(/[\\/:*?"<>|]/g, "").trim() || "video";
}

function parseMediaParts(manifest: string, playlistUrl: string) {
  const parts: MediaPart[] = [];
  let initPart: MediaPart | null = null;
  let pendingRange: string | undefined;
  let previousRangeEnd = -1;

  for (const rawLine of manifest.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const map = line.match(/^#EXT-X-MAP:.*URI="([^"]+)"/);
    if (map) {
      const rangeMatch = line.match(/BYTERANGE="(\d+)(?:@(\d+))?"/);
      let range: string | undefined;
      if (rangeMatch) {
        const length = Number(rangeMatch[1]);
        const offset = rangeMatch[2] == null ? 0 : Number(rangeMatch[2]);
        range = `bytes=${offset}-${offset + length - 1}`;
      }
      initPart = { url: absoluteUrl(map[1], playlistUrl), range };
      continue;
    }

    if (line.startsWith("#EXT-X-BYTERANGE:")) {
      const [lengthText, offsetText] = line.slice("#EXT-X-BYTERANGE:".length).split("@");
      const length = Number(lengthText);
      const offset = offsetText == null ? previousRangeEnd + 1 : Number(offsetText);
      if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(offset) || offset < 0) {
        throw new Error("This HLS stream has an invalid byte range.");
      }
      previousRangeEnd = offset + length - 1;
      pendingRange = `bytes=${offset}-${previousRangeEnd}`;
      continue;
    }

    if (line.startsWith("#")) continue;
    parts.push({ url: absoluteUrl(line, playlistUrl), range: pendingRange });
    pendingRange = undefined;
  }
  return { initPart, parts };
}

async function fetchMediaPart(part: MediaPart, signal?: AbortSignal): Promise<FetchResult> {
  const headers: HeadersInit = {};
  if (part.range) headers.Range = part.range;
  const response = await fetch(part.url, { signal, headers });
  if (!response.ok) throw new Error(`Video part failed (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    contentLength: response.headers.get("content-length"),
  };
}

async function fetchBatch(parts: MediaPart[], start: number, concurrency: number, signal?: AbortSignal) {
  const end = Math.min(parts.length, start + concurrency);
  return Promise.all(parts.slice(start, end).map(async (part, offset) => ({
    index: start + offset,
    part,
    result: await fetchMediaPart(part, signal),
  })));
}

async function loadMuxJs(signal?: AbortSignal): Promise<MuxJs> {
  if (window.muxjs) return window.muxjs;
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Download canceled", "AbortError"));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MUX_JS_URL}"]`);
    const script = existing || document.createElement("script");
    const abort = () => reject(new DOMException("Download canceled", "AbortError"));
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load the MP4 transmuxer.")), { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    if (!existing) {
      script.src = MUX_JS_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });
  if (!window.muxjs) throw new Error("The MP4 transmuxer did not initialize.");
  return window.muxjs;
}

function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

function saveMp4Blob(parts: BlobPart[], input: VidsrcDownloadRequest) {
  const blob = new Blob(parts, { type: "video/mp4" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${downloadName(input)}.mp4`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return blob.size;
}

function hasTransportStreamSync(bytes: Uint8Array) {
  if (bytes.byteLength < 188) return false;
  const maxOffset = Math.min(187, bytes.byteLength - 1);
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    if (bytes[offset] !== 0x47) continue;
    if (offset + 188 >= bytes.byteLength || bytes[offset + 188] === 0x47) return true;
  }
  return false;
}

async function transmuxTsSegment(muxjs: MuxJs, bytes: Uint8Array) {
  if (!hasTransportStreamSync(bytes)) throw new Error("The video part was not valid MPEG-TS data.");
  const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: true, remux: true });
  try {
    return await new Promise<MuxSegment[]>((resolve, reject) => {
      const output: MuxSegment[] = [];
      let settled = false;
      let fallbackTimer: number | null = null;
      const cleanup = () => {
        if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
        transmuxer.off?.("data", onData);
        transmuxer.off?.("done", onDone);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (output.length > 0) resolve(output);
        else reject(new Error("The MP4 transmuxer produced no output."));
      };
      const onData = (segment?: MuxSegment) => { if (segment) output.push(segment); };
      const onDone = () => finish();
      transmuxer.on("data", onData);
      transmuxer.on("done", onDone);
      try {
        transmuxer.push(bytes);
        transmuxer.flush();
        fallbackTimer = window.setTimeout(finish, 500);
      } catch (error) {
        settled = true;
        cleanup();
        reject(error);
      }
    });
  } finally {
    transmuxer.dispose?.();
  }
}

async function downloadWithMux(
  streamUrl: string,
  input: VidsrcDownloadRequest,
  options: DownloadOptions,
  report: (update: ProgressUpdate) => void,
  runId: string,
) {
  report({ stage: "loading", message: "Preparing low-memory MP4 download", progress: 0.06 });
  const selected = await selectMediaPlaylist(streamUrl, options.signal);
  if (!selected.manifest.includes("#EXT-X-ENDLIST")) throw new Error("This stream is live or unfinished, so it cannot be saved as an MP4.");
  if (selected.manifest.includes("#EXT-X-KEY")) throw new Error("Encrypted HLS streams are not supported.");

  const { initPart, parts } = parseMediaParts(selected.manifest, selected.url);
  if (!parts.length) throw new Error("The HLS playlist contains no video parts.");
  const concurrency = segmentConcurrency();
  logDownload(runId, "log", "playlist-ready", {
    playlist: safeUrlForLog(selected.url),
    parts: parts.length,
    format: initPart ? "fmp4" : "mpeg-ts",
    concurrency,
  });
  sendServerDiagnostic(runId, "playlist-ready", { parts: parts.length, format: initPart ? "fmp4" : "mpeg-ts", concurrency });

  const outputParts: BlobPart[] = [];
  let completed = 0;

  if (initPart) {
    const init = await fetchMediaPart(initPart, options.signal);
    outputParts.push(new Blob([toBlobPart(init.bytes)], { type: "video/mp4" }));
    for (let start = 0; start < parts.length; start += concurrency) {
      const batch = await fetchBatch(parts, start, concurrency, options.signal);
      for (const item of batch) outputParts.push(new Blob([toBlobPart(item.result.bytes)], { type: "video/mp4" }));
      completed = batch[batch.length - 1].index + 1;
      report({ stage: "downloading", message: `Downloading video part ${completed} of ${parts.length}`, progress: 0.1 + (completed / parts.length) * 0.82 });
      if (completed % 100 < concurrency || completed === parts.length) logDownload(runId, "log", "download-progress", { completed, total: parts.length });
    }
  } else {
    const muxjs = await loadMuxJs(options.signal);
    let wroteInitSegment = false;

    for (let start = 0; start < parts.length; start += concurrency) {
      const batch = await fetchBatch(parts, start, concurrency, options.signal);
      for (const item of batch) {
        if (options.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
        let fragments: MuxSegment[];
        try {
          fragments = await transmuxTsSegment(muxjs, item.result.bytes);
        } catch (firstError) {
          logDownload(runId, "warn", "segment-mux-retry", {
            part: item.index + 1,
            total: parts.length,
            error: errorMessage(firstError),
            url: safeUrlForLog(item.part.url),
            status: item.result.status,
            contentType: item.result.contentType,
            contentLength: item.result.contentLength,
            bytes: item.result.bytes.byteLength,
            firstBytes: bytePreview(item.result.bytes),
          });
          sendServerDiagnostic(runId, "segment-mux-retry", { part: item.index + 1, total: parts.length, error: errorMessage(firstError), contentType: item.result.contentType, bytes: item.result.bytes.byteLength, firstBytes: bytePreview(item.result.bytes) });

          const retry = await fetchMediaPart(item.part, options.signal);
          try {
            fragments = await transmuxTsSegment(muxjs, retry.bytes);
          } catch (secondError) {
            logDownload(runId, "error", "segment-mux-failed", {
              part: item.index + 1,
              total: parts.length,
              firstError: errorMessage(firstError),
              secondError: errorMessage(secondError),
              url: safeUrlForLog(item.part.url),
              retryContentType: retry.contentType,
              retryBytes: retry.bytes.byteLength,
              retryFirstBytes: bytePreview(retry.bytes),
            });
            sendServerDiagnostic(runId, "segment-mux-failed", { part: item.index + 1, total: parts.length, firstError: errorMessage(firstError), secondError: errorMessage(secondError), retryContentType: retry.contentType, retryBytes: retry.bytes.byteLength, retryFirstBytes: bytePreview(retry.bytes) });
            throw new Error(`Video part ${item.index + 1} of ${parts.length} could not be converted: ${errorMessage(secondError)}`);
          }
        }

        for (const fragment of fragments) {
          if (!wroteInitSegment && fragment.initSegment?.byteLength) {
            outputParts.push(new Blob([toBlobPart(fragment.initSegment)], { type: "video/mp4" }));
            wroteInitSegment = true;
          }
          if (fragment.data?.byteLength) outputParts.push(new Blob([toBlobPart(fragment.data)], { type: "video/mp4" }));
        }
      }

      completed = batch[batch.length - 1].index + 1;
      report({ stage: "downloading", message: `Downloading and converting video part ${completed} of ${parts.length}`, progress: 0.1 + (completed / parts.length) * 0.82 });
      if (completed % 100 < concurrency || completed === parts.length) logDownload(runId, "log", "mux-progress", { completed, total: parts.length, blobParts: outputParts.length });
    }

    if (!wroteInitSegment || outputParts.length < 2) throw new Error("The MP4 transmuxer could not create a valid MP4.");
  }

  report({ stage: "saving", message: "Saving the MP4", progress: 0.98 });
  logDownload(runId, "log", "creating-final-blob", { blobParts: outputParts.length });
  const size = saveMp4Blob(outputParts, input);
  logDownload(runId, "log", "download-started", { bytes: size, method: "mux" });
  sendServerDiagnostic(runId, "download-started", { bytes: size, method: "mux" });
  report({ stage: "saving", message: "Download started", progress: 1 });
}

function rewritePlaylist(manifest: string, playlistUrl: string) {
  const files: PlaylistFile[] = [];
  const rewritten = manifest.split(/\r?\n/).map((line) => {
    const map = line.match(/^#EXT-X-MAP:.*URI="([^"]+)"/);
    if (map) {
      const name = `init-${files.length}.mp4`;
      files.push({ name, url: absoluteUrl(map[1], playlistUrl) });
      return line.replace(map[1], name);
    }
    if (!line || line.startsWith("#")) return line;
    const url = absoluteUrl(line, playlistUrl);
    const extension = new URL(url).pathname.match(/\.[a-z0-9]+$/i)?.[0] || ".ts";
    const name = `segment-${files.length}${extension}`;
    files.push({ name, url });
    return name;
  });
  return { manifest: rewritten.join("\n"), files };
}

async function createClassWorkerUrl(signal?: AbortSignal): Promise<string> {
  const source = await fetchText(`${FFMPEG_PACKAGE_BASE}/worker.js`, signal);
  const sameOriginSource = source
    .replace('from "./const.js"', `from "${FFMPEG_PACKAGE_BASE}/const.js"`)
    .replace('from "./errors.js"', `from "${FFMPEG_PACKAGE_BASE}/errors.js"`);
  return URL.createObjectURL(new Blob([sameOriginSource], { type: "text/javascript" }));
}

async function downloadWithFfmpeg(
  streamUrl: string,
  input: VidsrcDownloadRequest,
  options: DownloadOptions,
  report: (update: ProgressUpdate) => void,
  runId: string,
) {
  let ffmpeg: FFmpegInstance | null = null;
  let classWorkerUrl: string | null = null;
  try {
    report({ stage: "loading", message: "Loading compatibility MP4 converter", progress: 0.08 });
    logDownload(runId, "warn", "ffmpeg-fallback-started");
    const dynamicImport = Function("url", "return import(url)") as (url: string) => Promise<any>;
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([dynamicImport(FFMPEG_PACKAGE_URL), dynamicImport(FFMPEG_UTIL_URL)]);
    ffmpeg = new FFmpeg() as FFmpegInstance;
    classWorkerUrl = await createClassWorkerUrl(options.signal);
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      classWorkerURL: classWorkerUrl,
    });

    const selected = await selectMediaPlaylist(streamUrl, options.signal);
    if (!selected.manifest.includes("#EXT-X-ENDLIST")) throw new Error("This stream is live or unfinished, so it cannot be saved as an MP4.");
    if (selected.manifest.includes("#EXT-X-KEY")) throw new Error("Encrypted HLS streams are not supported.");

    const playlist = rewritePlaylist(selected.manifest, selected.url);
    await ffmpeg.writeFile("input.m3u8", new TextEncoder().encode(playlist.manifest));
    const concurrency = segmentConcurrency();
    for (let start = 0; start < playlist.files.length; start += concurrency) {
      const batchFiles = playlist.files.slice(start, start + concurrency);
      const batch = await Promise.all(batchFiles.map(async (file, offset) => ({
        index: start + offset,
        file,
        bytes: new Uint8Array(await (await fetch(file.url, { signal: options.signal })).arrayBuffer()),
      })));
      for (const item of batch) await ffmpeg.writeFile(item.file.name, item.bytes);
      const completed = Math.min(start + batch.length, playlist.files.length);
      report({ stage: "downloading", message: `Compatibility download part ${completed} of ${playlist.files.length}`, progress: 0.12 + (completed / playlist.files.length) * 0.68 });
      if (completed % 100 < concurrency || completed === playlist.files.length) logDownload(runId, "log", "ffmpeg-download-progress", { completed, total: playlist.files.length });
    }

    report({ stage: "converting", message: "Converting HLS to MP4", progress: 0.84 });
    logDownload(runId, "log", "ffmpeg-exec-started", { files: playlist.files.length });
    const exitCode = await ffmpeg.exec(["-allowed_extensions", "ALL", "-i", "input.m3u8", "-c", "copy", "-movflags", "+faststart", "output.mp4"]);
    logDownload(runId, exitCode === 0 ? "log" : "error", "ffmpeg-exec-finished", { exitCode });
    if (exitCode !== 0) throw new Error(`The MP4 converter stopped with code ${exitCode}.`);

    report({ stage: "saving", message: "Saving the MP4", progress: 0.98 });
    const output = await ffmpeg.readFile("output.mp4");
    if (typeof output === "string") throw new Error("The converter returned an invalid MP4 file.");
    const size = saveMp4Blob([new Blob([toBlobPart(output)], { type: "video/mp4" })], input);
    logDownload(runId, "log", "download-started", { bytes: size, method: "ffmpeg" });
    sendServerDiagnostic(runId, "download-started", { bytes: size, method: "ffmpeg" });
    report({ stage: "saving", message: "Download started", progress: 1 });
  } catch (error) {
    logDownload(runId, "error", "ffmpeg-failed", { error: errorMessage(error) });
    sendServerDiagnostic(runId, "ffmpeg-failed", { error: errorMessage(error) });
    throw error;
  } finally {
    ffmpeg?.terminate();
    if (classWorkerUrl) URL.revokeObjectURL(classWorkerUrl);
  }
}

export async function extractVidsrcStream(input: VidsrcDownloadRequest, signal?: AbortSignal) {
  const url = new URL(`${getApiBase()}/extract`);
  url.searchParams.set("tmdb_id", String(input.tmdbId));
  url.searchParams.set("type", input.mediaType);
  if (input.mediaType === "tv") {
    url.searchParams.set("season", String(input.season || 1));
    url.searchParams.set("episode", String(input.episode || 1));
  }
  const response = await fetch(url.toString(), { signal });
  const payload = (await response.json().catch(() => null)) as ExtractResponse | null;
  if (!response.ok || !payload) throw new Error(`Stream extraction failed (${response.status}).`);
  const stream = findStream(payload);
  if (!payload.success || !stream) {
    const providerError = Object.values(payload.results || {}).find((item) => item?.error)?.error;
    throw new Error(payload.error || providerError || "The API did not return a downloadable stream.");
  }
  return stream;
}

export async function downloadVidsrcMp4(input: VidsrcDownloadRequest, options: DownloadOptions = {}) {
  const report = options.onProgress || (() => {});
  const runId = createRunId();
  logDownload(runId, "log", "download-start", {
    title: input.title,
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    mobile: isMobileDevice(),
    concurrency: segmentConcurrency(),
  });
  sendServerDiagnostic(runId, "download-start", { title: input.title, tmdbId: input.tmdbId, mediaType: input.mediaType, mobile: isMobileDevice(), concurrency: segmentConcurrency() });

  report({ stage: "extracting", message: "Finding the video stream", progress: 0.02 });
  const streamUrl = await extractVidsrcStream(input, options.signal);
  logDownload(runId, "log", "stream-found", { stream: safeUrlForLog(streamUrl) });

  let muxError: unknown = null;
  try {
    await downloadWithMux(streamUrl, input, options, report, runId);
    return;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (options.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
    muxError = error;
    logDownload(runId, "error", "mux-path-failed", { error: errorMessage(error) });
    sendServerDiagnostic(runId, "mux-path-failed", { error: errorMessage(error) });
  }

  report({ stage: "loading", message: "Low-memory converter failed; switching to compatibility mode", progress: 0.05 });
  try {
    await downloadWithFfmpeg(streamUrl, input, options, report, runId);
  } catch (ffmpegError) {
    const combined = `Low-memory download failed: ${errorMessage(muxError)} Compatibility mode also failed: ${errorMessage(ffmpegError)}`;
    logDownload(runId, "error", "download-failed", { muxError: errorMessage(muxError), ffmpegError: errorMessage(ffmpegError) });
    sendServerDiagnostic(runId, "download-failed", { muxError: errorMessage(muxError), ffmpegError: errorMessage(ffmpegError) });
    throw new Error(combined);
  }
}
