const DEFAULT_API_BASE = "https://vidsrc-scraper-serverless.vercel.app";
const FFMPEG_PACKAGE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
const FFMPEG_PACKAGE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm";
const FFMPEG_UTIL_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";
const FFMPEG_CORE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

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
