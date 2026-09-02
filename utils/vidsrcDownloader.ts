const DEFAULT_API_BASE = "https://vidsrc-scraper-serverless.vercel.app";
const MUX_JS_URL = "https://cdn.jsdelivr.net/npm/mux.js@6.3.0/dist/mux.min.js";
const LOG_PREFIX = "[ImpactStream Download]";
const FETCH_RETRY_DELAYS = [0, 750, 1500, 3000, 6000, 10000];

type MediaType = "movie" | "tv";
type ExtractResult = { hls_url?: string | null; error?: string | null };
type ExtractResponse = {
  success?: boolean;
  error?: string;
  results?: Record<string, ExtractResult>;
};
type ProgressUpdate = {
  stage: "extracting" | "loading" | "downloading" | "converting" | "saving";
  message: string;
  progress: number;
};
type DownloadOptions = {
  signal?: AbortSignal;
  onProgress?: (update: ProgressUpdate) => void;
};
type MediaPart = { url: string; range?: string };
type FetchResult = {
  bytes: Uint8Array;
  status: number;
  contentType: string;
  contentLength: string | null;
};
type MuxSegment = { initSegment?: Uint8Array; data?: Uint8Array };
type MuxTransmuxer = {
  on: (event: string, callback: (segment?: MuxSegment) => void) => void;
  off?: (event: string, callback: (segment?: MuxSegment) => void) => void;
  push: (data: Uint8Array) => void;
  flush: () => void;
  dispose?: () => void;
};
type MuxJs = {
  mp4: { Transmuxer: new (options?: Record<string, unknown>) => MuxTransmuxer };
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

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_VIDSRC_API_URL || DEFAULT_API_BASE).replace(/\/$/, "");
}

function createRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function safeUrlForLog(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split("?")[0];
  }
}

function bytePreview(bytes: Uint8Array, count = 24) {
  return Array.from(bytes.subarray(0, count))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join(" ");
}

function logDownload(
  runId: string,
  level: "log" | "warn" | "error",
  event: string,
  details: Record<string, unknown> = {},
) {
  console[level](LOG_PREFIX, { runId, event, ...details });
}

function sendServerDiagnostic(runId: string, event: string, details: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  void fetch("/api/download-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId, event, timestamp: new Date().toISOString(), ...details }),
    keepalive: true,
  }).catch(() => undefined);
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const iPadDesktopMode = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return mobileUserAgent || iPadDesktopMode;
}

function segmentConcurrency() {
  if (isMobileDevice()) return 3;
  const cores = typeof navigator === "undefined" ? 8 : navigator.hardwareConcurrency || 8;
  return Math.max(4, Math.min(8, Math.ceil(cores / 2)));
}

function findStream(payload: ExtractResponse): string | null {
  for (const result of Object.values(payload.results || {})) {
    if (typeof result?.hls_url === "string" && result.hls_url.length > 0) return result.hls_url;
  }
  return null;
}

function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Download canceled", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Download canceled", "AbortError"));
      },
      { once: true },
    );
  });
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
    if (uri && (!best || bandwidth > best.bandwidth)) {
      best = { bandwidth, url: absoluteUrl(uri, url) };
    }
  }

  if (!best) throw new Error("No playable HLS variant was found.");
  return { url: best.url, manifest: await fetchText(best.url, signal) };
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

function downloadName(input: VidsrcDownloadRequest): string {
  const suffix = input.mediaType === "tv"
    ? ` S${String(input.season || 1).padStart(2, "0")}E${String(input.episode || 1).padStart(2, "0")}`
    : "";
  return `${input.title}${suffix}`.replace(/[\\/:*?"<>|]/g, "").trim() || "video";
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

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchMediaPart(
  part: MediaPart,
  signal?: AbortSignal,
  runId?: string,
  partNumber?: number,
  total?: number,
): Promise<FetchResult> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < FETCH_RETRY_DELAYS.length; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Download canceled", "AbortError");
    await sleep(FETCH_RETRY_DELAYS[attempt], signal);

    const headers: HeadersInit = {};
    if (part.range) headers.Range = part.range;

    try {
      const response = await fetch(part.url, { signal, headers });
      if (!response.ok) {
        const error = new Error(`Video part failed (${response.status}).`);
        if (!isRetryableStatus(response.status)) throw error;
        lastError = error;
      } else {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (attempt > 0 && runId) {
          logDownload(runId, "log", "segment-fetch-recovered", {
            part: partNumber,
            total,
            attempt: attempt + 1,
            bytes: bytes.byteLength,
          });
        }
        return {
          bytes,
          status: response.status,
          contentType: response.headers.get("content-type") || "",
          contentLength: response.headers.get("content-length"),
        };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastError = error;
    }

    if (runId && attempt + 1 < FETCH_RETRY_DELAYS.length) {
      logDownload(runId, "warn", "segment-fetch-retry", {
        part: partNumber,
        total,
        attempt: attempt + 1,
        error: errorMessage(lastError),
        nextDelayMs: FETCH_RETRY_DELAYS[attempt + 1],
        url: safeUrlForLog(part.url),
      });
    }
  }

  if (runId) {
    logDownload(runId, "error", "segment-fetch-exhausted", {
      part: partNumber,
      total,
      error: errorMessage(lastError),
      url: safeUrlForLog(part.url),
    });
  }
  throw lastError instanceof Error ? lastError : new Error("Video part could not be downloaded.");
}

async function fetchBatch(
  parts: MediaPart[],
  start: number,
  concurrency: number,
  signal: AbortSignal | undefined,
  runId: string,
) {
  const end = Math.min(parts.length, start + concurrency);
  return Promise.all(
    parts.slice(start, end).map(async (part, offset) => {
      const index = start + offset;
      return {
        index,
        part,
        result: await fetchMediaPart(part, signal, runId, index + 1, parts.length),
      };
    }),
  );
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
    const loaded = () => resolve();
    const failed = () => reject(new Error("Could not load the MP4 transmuxer."));
    const aborted = () => reject(new DOMException("Download canceled", "AbortError"));

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", aborted, { once: true });

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

function findTransportStreamOffset(bytes: Uint8Array) {
  if (bytes.byteLength < 188) return -1;
  const packetSizes = [188, 192, 204];
  const scanLimit = Math.min(bytes.byteLength - 1, 64 * 1024);

  for (const packetSize of packetSizes) {
    for (let offset = 0; offset <= scanLimit; offset += 1) {
      if (bytes[offset] !== 0x47) continue;
      const second = offset + packetSize;
      const third = second + packetSize;
      if (second < bytes.byteLength && bytes[second] !== 0x47) continue;
      if (third < bytes.byteLength && bytes[third] !== 0x47) continue;
      return offset;
    }
  }
  return -1;
}

async function transmuxTsSegment(muxjs: MuxJs, originalBytes: Uint8Array) {
  const syncOffset = findTransportStreamOffset(originalBytes);
  // Do not reject a segment solely because our heuristic cannot find sync.
  // mux.js is the authoritative parser and can handle some metadata-prefixed TS.
  const bytes = syncOffset > 0 ? originalBytes.subarray(syncOffset) : originalBytes;
  const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: true, remux: true });

  try {
    return await new Promise<MuxSegment[]>((resolve, reject) => {
      const output: MuxSegment[] = [];
      let settled = false;
      let timer: number | null = null;

      const cleanup = () => {
        if (timer != null) window.clearTimeout(timer);
        transmuxer.off?.("data", onData);
        transmuxer.off?.("done", onDone);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (output.some((item) => item.data?.byteLength)) resolve(output);
        else reject(new Error("The MP4 transmuxer produced no output."));
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
        timer = window.setTimeout(finish, 750);
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

async function refreshLogicalPart(
  input: VidsrcDownloadRequest,
  index: number,
  expectedTotal: number,
  signal: AbortSignal | undefined,
  runId: string,
) {
  logDownload(runId, "warn", "playlist-refresh-started", {
    part: index + 1,
    expectedTotal,
  });
  sendServerDiagnostic(runId, "playlist-refresh-started", { part: index + 1, expectedTotal });

  const freshStream = await extractVidsrcStream(input, signal);
  const freshSelected = await selectMediaPlaylist(freshStream, signal);
  const freshParsed = parseMediaParts(freshSelected.manifest, freshSelected.url);
  if (freshParsed.initPart) throw new Error("The refreshed stream changed from MPEG-TS to fMP4.");
  if (index >= freshParsed.parts.length) {
    throw new Error(`The refreshed playlist only had ${freshParsed.parts.length} parts.`);
  }

  const freshPart = freshParsed.parts[index];
  const result = await fetchMediaPart(freshPart, signal, runId, index + 1, freshParsed.parts.length);
  logDownload(runId, "log", "playlist-refresh-part-fetched", {
    part: index + 1,
    oldTotal: expectedTotal,
    freshTotal: freshParsed.parts.length,
    bytes: result.bytes.byteLength,
    contentType: result.contentType,
    firstBytes: bytePreview(result.bytes),
  });
  return { part: freshPart, result, freshTotal: freshParsed.parts.length };
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
  if (!selected.manifest.includes("#EXT-X-ENDLIST")) {
    throw new Error("This stream is live or unfinished, so it cannot be saved as an MP4.");
  }
  if (selected.manifest.includes("#EXT-X-KEY")) {
    throw new Error("Encrypted HLS streams are not supported.");
  }

  const { initPart, parts } = parseMediaParts(selected.manifest, selected.url);
  if (!parts.length) throw new Error("The HLS playlist contains no video parts.");

  const concurrency = segmentConcurrency();
  logDownload(runId, "log", "playlist-ready", {
    playlist: safeUrlForLog(selected.url),
    parts: parts.length,
    format: initPart ? "fmp4" : "mpeg-ts",
    concurrency,
    mobile: isMobileDevice(),
  });
  sendServerDiagnostic(runId, "playlist-ready", {
    parts: parts.length,
    format: initPart ? "fmp4" : "mpeg-ts",
    concurrency,
    mobile: isMobileDevice(),
  });

  const outputParts: BlobPart[] = [];
  let completed = 0;

  if (initPart) {
    const init = await fetchMediaPart(initPart, options.signal, runId, 0, parts.length);
    outputParts.push(new Blob([toBlobPart(init.bytes)], { type: "video/mp4" }));

    for (let start = 0; start < parts.length; start += concurrency) {
      const batch = await fetchBatch(parts, start, concurrency, options.signal, runId);
      for (const item of batch) {
        outputParts.push(new Blob([toBlobPart(item.result.bytes)], { type: "video/mp4" }));
      }
      completed = batch[batch.length - 1].index + 1;
      report({
        stage: "downloading",
        message: `Downloading video part ${completed} of ${parts.length}`,
        progress: 0.1 + (completed / parts.length) * 0.82,
      });
      if (completed % 100 < concurrency || completed === parts.length) {
        logDownload(runId, "log", "download-progress", { completed, total: parts.length });
      }
    }
  } else {
    const muxjs = await loadMuxJs(options.signal);
    let wroteInitSegment = false;

    for (let start = 0; start < parts.length; start += concurrency) {
      const batch = await fetchBatch(parts, start, concurrency, options.signal, runId);

      for (const item of batch) {
        if (options.signal?.aborted) throw new DOMException("Download canceled", "AbortError");

        let fragments: MuxSegment[];
        let activeResult = item.result;
        try {
          fragments = await transmuxTsSegment(muxjs, activeResult.bytes);
        } catch (firstError) {
          const syncOffset = findTransportStreamOffset(activeResult.bytes);
          logDownload(runId, "warn", "segment-mux-retry", {
            part: item.index + 1,
            total: parts.length,
            error: errorMessage(firstError),
            url: safeUrlForLog(item.part.url),
            status: activeResult.status,
            contentType: activeResult.contentType,
            bytes: activeResult.bytes.byteLength,
            syncOffset,
            firstBytes: bytePreview(activeResult.bytes),
          });

          const sameUrlRetry = await fetchMediaPart(
            item.part,
            options.signal,
            runId,
            item.index + 1,
            parts.length,
          );

          try {
            activeResult = sameUrlRetry;
            fragments = await transmuxTsSegment(muxjs, sameUrlRetry.bytes);
          } catch (secondError) {
            logDownload(runId, "warn", "segment-refresh-retry", {
              part: item.index + 1,
              total: parts.length,
              firstError: errorMessage(firstError),
              secondError: errorMessage(secondError),
              retryBytes: sameUrlRetry.bytes.byteLength,
              retrySyncOffset: findTransportStreamOffset(sameUrlRetry.bytes),
              retryFirstBytes: bytePreview(sameUrlRetry.bytes),
            });

            const refreshed = await refreshLogicalPart(
              input,
              item.index,
              parts.length,
              options.signal,
              runId,
            );

            try {
              activeResult = refreshed.result;
              fragments = await transmuxTsSegment(muxjs, refreshed.result.bytes);
              logDownload(runId, "log", "segment-refresh-recovered", {
                part: item.index + 1,
                total: parts.length,
                freshTotal: refreshed.freshTotal,
                bytes: refreshed.result.bytes.byteLength,
                syncOffset: findTransportStreamOffset(refreshed.result.bytes),
              });
              sendServerDiagnostic(runId, "segment-refresh-recovered", {
                part: item.index + 1,
                total: parts.length,
                freshTotal: refreshed.freshTotal,
              });
            } catch (thirdError) {
              logDownload(runId, "error", "segment-mux-failed", {
                part: item.index + 1,
                total: parts.length,
                firstError: errorMessage(firstError),
                secondError: errorMessage(secondError),
                refreshError: errorMessage(thirdError),
                refreshedContentType: refreshed.result.contentType,
                refreshedBytes: refreshed.result.bytes.byteLength,
                refreshedSyncOffset: findTransportStreamOffset(refreshed.result.bytes),
                refreshedFirstBytes: bytePreview(refreshed.result.bytes),
              });
              sendServerDiagnostic(runId, "segment-mux-failed", {
                part: item.index + 1,
                total: parts.length,
                firstError: errorMessage(firstError),
                secondError: errorMessage(secondError),
                refreshError: errorMessage(thirdError),
                refreshedContentType: refreshed.result.contentType,
                refreshedBytes: refreshed.result.bytes.byteLength,
                refreshedFirstBytes: bytePreview(refreshed.result.bytes),
              });
              throw new Error(
                `Video part ${item.index + 1} of ${parts.length} could not be converted after refreshing the playlist: ${errorMessage(thirdError)}`,
              );
            }
          }
        }

        if (!activeResult.bytes.byteLength) {
          throw new Error(`Video part ${item.index + 1} was empty.`);
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

      completed = batch[batch.length - 1].index + 1;
      report({
        stage: "downloading",
        message: `Downloading and converting video part ${completed} of ${parts.length}`,
        progress: 0.1 + (completed / parts.length) * 0.82,
      });
      if (completed % 100 < concurrency || completed === parts.length) {
        logDownload(runId, "log", "mux-progress", {
          completed,
          total: parts.length,
          blobParts: outputParts.length,
        });
      }
    }

    if (!wroteInitSegment || outputParts.length < 2) {
      throw new Error("The MP4 transmuxer could not create a valid MP4.");
    }
  }

  report({ stage: "saving", message: "Saving the MP4", progress: 0.98 });
  logDownload(runId, "log", "creating-final-blob", { blobParts: outputParts.length });
  const size = saveMp4Blob(outputParts, input);
  logDownload(runId, "log", "download-started", { bytes: size, method: "mux" });
  sendServerDiagnostic(runId, "download-started", { bytes: size, method: "mux" });
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
  const runId = createRunId();
  const concurrency = segmentConcurrency();

  logDownload(runId, "log", "download-start", {
    title: input.title,
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    mobile: isMobileDevice(),
    concurrency,
    method: "mux",
  });
  sendServerDiagnostic(runId, "download-start", {
    title: input.title,
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    mobile: isMobileDevice(),
    concurrency,
    method: "mux",
  });

  try {
    report({ stage: "extracting", message: "Finding the video stream", progress: 0.02 });
    const streamUrl = await extractVidsrcStream(input, options.signal);
    logDownload(runId, "log", "stream-found", { stream: safeUrlForLog(streamUrl) });
    await downloadWithMux(streamUrl, input, options, report, runId);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    logDownload(runId, "error", "download-failed", { error: errorMessage(error) });
    sendServerDiagnostic(runId, "download-failed", { error: errorMessage(error) });
    throw error;
  }
}
