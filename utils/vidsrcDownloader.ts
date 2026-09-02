const DEFAULT_API_BASE = "https://vidsrc-scraper-serverless.vercel.app";
const FFMPEG_PACKAGE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
const FFMPEG_PACKAGE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm";
const FFMPEG_UTIL_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";
const FFMPEG_CORE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const MUX_JS_URL = "https://cdn.jsdelivr.net/npm/mux.js@6.3.0/dist/mux.min.js";

type MediaType = "movie" | "tv";
type ExtractResult = { hls_url?: string | null; error?: string | null };
type ExtractResponse = {
  success?: boolean;
  error?: string;
  results?: Record<string, ExtractResult>;
};
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

type MuxSegment = {
  initSegment?: Uint8Array;
  data?: Uint8Array;
};
type MuxTransmuxer = {
  on: (event: string, callback: (segment?: MuxSegment) => void) => void;
  off?: (event: string, callback: (segment?: MuxSegment) => void) => void;
  push: (data: Uint8Array) => void;
  flush: () => void;
  dispose?: () => void;
};
type MuxJs = {
  mp4: {
    Transmuxer: new (options?: Record<string, unknown>) => MuxTransmuxer;
  };
};

declare global {
  interface Window {
    muxjs?: MuxJs;
  }
}

export type VidsrcDownloadRequest = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  season?: number;
  episode?: number;
};
type DownloadOptions = {
  signal?: AbortSignal;
  onProgress?: (update: ProgressUpdate) => void;
};
type PlaylistFile = { name: string; url: string };
type MobileMediaPart = { url: string; range?: string };

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_VIDSRC_API_URL || DEFAULT_API_BASE).replace(/\/$/, "");
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

async function createClassWorkerUrl(signal?: AbortSignal): Promise<string> {
  const source = await fetchText(`${FFMPEG_PACKAGE_BASE}/worker.js`, signal);
  const sameOriginSource = source
    .replace('from "./const.js"', `from "${FFMPEG_PACKAGE_BASE}/const.js"`)
    .replace('from "./errors.js"', `from "${FFMPEG_PACKAGE_BASE}/errors.js"`);
  return URL.createObjectURL(new Blob([sameOriginSource], { type: "text/javascript" }));
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
    if (uri && (!best || bandwidth > best.bandwidth)) {
      best = { bandwidth, url: absoluteUrl(uri, url) };
    }
  }
  if (!best) throw new Error("No playable HLS variant was found.");
  return { url: best.url, manifest: await fetchText(best.url, signal) };
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

function downloadName(input: VidsrcDownloadRequest): string {
  const suffix = input.mediaType === "tv"
    ? ` S${String(input.season || 1).padStart(2, "0")}E${String(input.episode || 1).padStart(2, "0")}`
    : "";
  return `${input.title}${suffix}`.replace(/[\\/:*?"<>|]/g, "").trim() || "video";
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const iPadDesktopMode = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return mobileUserAgent || iPadDesktopMode;
}

function parseMobileMediaParts(manifest: string, playlistUrl: string) {
  const parts: MobileMediaPart[] = [];
  let initPart: MobileMediaPart | null = null;
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
      const value = line.slice("#EXT-X-BYTERANGE:".length);
      const [lengthText, offsetText] = value.split("@");
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

async function fetchMediaPart(part: MobileMediaPart, signal?: AbortSignal) {
  const headers: HeadersInit = {};
  if (part.range) headers.Range = part.range;
  const response = await fetch(part.url, { signal, headers });
  if (!response.ok) throw new Error(`Video part failed (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

async function loadMuxJs(signal?: AbortSignal): Promise<MuxJs> {
  if (window.muxjs) return window.muxjs;

  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Download canceled", "AbortError"));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MUX_JS_URL}"]`);
    const script = existing || document.createElement("script");
    const abort = () => reject(new DOMException("Download canceled", "AbortError"));
    const loaded = () => resolve();
    const failed = () => reject(new Error("Could not load the mobile MP4 converter."));

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", abort, { once: true });

    if (!existing) {
      script.src = MUX_JS_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });

  if (!window.muxjs) throw new Error("The mobile MP4 converter did not initialize.");
  return window.muxjs;
}

function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

function saveMp4Blob(parts: BlobPart[], input: VidsrcDownloadRequest) {
  const objectUrl = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${downloadName(input)}.mp4`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
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
  if (!hasTransportStreamSync(bytes)) {
    throw new Error("The video part was not valid MPEG-TS data.");
  }

  const transmuxer = new muxjs.mp4.Transmuxer({
    keepOriginalTimestamps: true,
    remux: true,
  });

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
        else reject(new Error("The mobile MP4 converter produced no output."));
      };
      const onData = (segment?: MuxSegment) => {
        if (segment) output.push(segment);
      };
      const onDone = () => finish();

      transmuxer.on("data", onData);
      transmuxer.on("done", onDone);

      try {
        transmuxer.push(bytes);
        transmuxer.flush();
        // Give busy mobile browsers time to deliver mux.js events instead of treating
        // a 0 ms scheduling delay as a failed conversion.
        fallbackTimer = window.setTimeout(finish, 250);
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

async function downloadMobileMp4(
  streamUrl: string,
  input: VidsrcDownloadRequest,
  options: DownloadOptions,
  report: (update: ProgressUpdate) => void,
) {
  report({ stage: "loading", message: "Preparing mobile MP4 download", progress: 0.06 });
  const selected = await selectMediaPlaylist(streamUrl, options.signal);
  if (!selected.manifest.includes("#EXT-X-ENDLIST")) {
    throw new Error("This stream is live or unfinished, so it cannot be saved as an MP4.");
  }
  if (selected.manifest.includes("#EXT-X-KEY")) {
    throw new Error("Encrypted HLS streams are not supported.");
  }

  const { initPart, parts } = parseMobileMediaParts(selected.manifest, selected.url);
  if (!parts.length) throw new Error("The HLS playlist contains no video parts.");

  const outputParts: BlobPart[] = [];

  if (initPart) {
    const initBytes = await fetchMediaPart(initPart, options.signal);
    outputParts.push(new Blob([toBlobPart(initBytes)], { type: "video/mp4" }));

    for (let index = 0; index < parts.length; index += 1) {
      if (options.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
      report({
        stage: "downloading",
        message: `Downloading video part ${index + 1} of ${parts.length}`,
        progress: 0.1 + ((index + 1) / parts.length) * 0.82,
      });
      const bytes = await fetchMediaPart(parts[index], options.signal);
      outputParts.push(new Blob([toBlobPart(bytes)], { type: "video/mp4" }));
    }
  } else {
    const muxjs = await loadMuxJs(options.signal);
    let wroteInitSegment = false;

    for (let index = 0; index < parts.length; index += 1) {
      if (options.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
      report({
        stage: "downloading",
        message: `Downloading and converting video part ${index + 1} of ${parts.length}`,
        progress: 0.1 + ((index + 1) / parts.length) * 0.82,
      });

      let tsBytes = await fetchMediaPart(parts[index], options.signal);
      let fragments: MuxSegment[];
      try {
        fragments = await transmuxTsSegment(muxjs, tsBytes);
      } catch (firstError) {
        if (options.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
        // A transient CDN/body issue should not kill a multi-thousand-part download.
        // Re-fetch once and retry with another fresh transmuxer.
        tsBytes = await fetchMediaPart(parts[index], options.signal);
        try {
          fragments = await transmuxTsSegment(muxjs, tsBytes);
        } catch {
          const detail = firstError instanceof Error ? firstError.message : "conversion failed";
          throw new Error(`Video part ${index + 1} of ${parts.length} could not be converted: ${detail}`);
        }
      }

      for (const fragment of fragments) {
        if (!wroteInitSegment && fragment.initSegment?.byteLength) {
          outputParts.push(new Blob([toBlobPart(fragment.initSegment)], { type: "video/mp4" }));
          wroteInitSegment = true;
        }
        if (fragment.data?.byteLength) {
          outputParts.push(new Blob([toBlobPart(fragment.data)], { type: "video/mp4" }));
        }
      }
    }

    if (!wroteInitSegment || outputParts.length < 2) {
      throw new Error("The mobile MP4 converter could not create a valid MP4.");
    }
  }

  report({ stage: "saving", message: "Saving the MP4", progress: 0.98 });
  saveMp4Blob(outputParts, input);
  report({ stage: "saving", message: "Download started", progress: 1 });
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
  let ffmpeg: FFmpegInstance | null = null;
  let classWorkerUrl: string | null = null;
  try {
    report({ stage: "extracting", message: "Finding the video stream", progress: 0.02 });
    const streamUrl = await extractVidsrcStream(input, options.signal);

    if (isMobileDevice()) {
      await downloadMobileMp4(streamUrl, input, options, report);
      return;
    }

    report({ stage: "loading", message: "Loading the MP4 converter", progress: 0.08 });
    const dynamicImport = Function("url", "return import(url)") as (url: string) => Promise<any>;
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      dynamicImport(FFMPEG_PACKAGE_URL),
      dynamicImport(FFMPEG_UTIL_URL),
    ]);
    ffmpeg = new FFmpeg() as FFmpegInstance;
    classWorkerUrl = await createClassWorkerUrl(options.signal);
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      classWorkerURL: classWorkerUrl,
    });

    const selected = await selectMediaPlaylist(streamUrl, options.signal);
    if (!selected.manifest.includes("#EXT-X-ENDLIST")) {
      throw new Error("This stream is live or unfinished, so it cannot be saved as an MP4.");
    }
    if (selected.manifest.includes("#EXT-X-KEY")) throw new Error("Encrypted HLS streams are not supported.");

    const playlist = rewritePlaylist(selected.manifest, selected.url);
    await ffmpeg.writeFile("input.m3u8", new TextEncoder().encode(playlist.manifest));
    for (let index = 0; index < playlist.files.length; index += 1) {
      if (options.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
      const file = playlist.files[index];
      report({
        stage: "downloading",
        message: `Downloading video part ${index + 1} of ${playlist.files.length}`,
        progress: 0.12 + ((index + 1) / playlist.files.length) * 0.68,
      });
      const response = await fetch(file.url, { signal: options.signal });
      if (!response.ok) throw new Error(`Video part ${index + 1} failed (${response.status}).`);
      await ffmpeg.writeFile(file.name, new Uint8Array(await response.arrayBuffer()));
    }

    report({ stage: "converting", message: "Converting HLS to MP4", progress: 0.84 });
    const exitCode = await ffmpeg.exec([
      "-allowed_extensions", "ALL", "-i", "input.m3u8", "-c", "copy",
      "-movflags", "+faststart", "output.mp4",
    ]);
    if (exitCode !== 0) throw new Error(`The MP4 converter stopped with code ${exitCode}.`);

    report({ stage: "saving", message: "Saving the MP4", progress: 0.98 });
    const output = await ffmpeg.readFile("output.mp4");
    if (typeof output === "string") throw new Error("The converter returned an invalid MP4 file.");
    const objectUrl = URL.createObjectURL(new Blob([new Uint8Array(output)], { type: "video/mp4" }));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${downloadName(input)}.mp4`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    report({ stage: "saving", message: "Download started", progress: 1 });
  } finally {
    ffmpeg?.terminate();
    if (classWorkerUrl) URL.revokeObjectURL(classWorkerUrl);
  }
}