import CryptoJS from "crypto-js";
import Hashids from "hashids";

const CONSTANT_HEX_XOR = "8c465aa8af6cbfd4c1f91bf0c8d678ba";
const TMDB_SALT = "d486ae1ce6fdbe63b60bd1704541fcf0";

type MediaType = "movie" | "tv";

export type SourceItem = {
  url: string;
  quality?: string;
};

export type SubtitleItem = {
  url: string;
  language?: string;
  label?: string;
};

type DecodeResult = {
  sources?: SourceItem[];
  subtitles?: SubtitleItem[];
};

export type DownloadRequest = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year?: string;
  seasonId?: number;
  episodeId?: number;
  totalSeasons?: number;
  imdbId?: string;
};

export type DownloaderLogger = (
  step: string,
  data?: Record<string, unknown>
) => void;

type FetchVideasyOptions = {
  logger?: DownloaderLogger;
};

type WasmApi = {
  serve: () => string;
  verify: (hash: string) => boolean;
  decrypt: (encrypted: string, tmdbId: number) => string;
};

let wasmApiPromise: Promise<WasmApi> | null = null;

function isBrowserRuntime(): boolean {
  return typeof window !== "undefined";
}

function getServerWasmUrl(): string | null {
  const explicit = process.env.VIDEASY_WASM_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return `${explicit.replace(/\/$/, "")}/module.wasm`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/module.wasm`;
  }

  return null;
}

function c7(input: string): string {
  const constCodes = CONSTANT_HEX_XOR.split("").map((c) => c.charCodeAt(0));
  return input
    .split("")
    .map((ch) => ch.charCodeAt(0))
    .map((code) => constCodes.reduce((acc, k) => acc ^ k, code))
    .map((n) => (`0${Number(n).toString(16)}`).slice(-2))
    .join("");
}

function buildB35(tmdbId: number): string {
  const k = c7(String(tmdbId) + TMDB_SALT);
  const hashids = new Hashids();
  return hashids.encode(k as unknown as number);
}

function toMediaTitle(input: DownloadRequest): string {
  const yearSuffix = input.year ? ` - [${input.year}]` : "";
  if (input.mediaType === "movie") {
    return `${input.title}${yearSuffix}`;
  }

  const season = Number(input.seasonId || 1);
  const episode = Number(input.episodeId || 1);
  return `${input.title} | S${season}E${episode}${yearSuffix}`;
}

function getPopup(): Window {
  if (!isBrowserRuntime()) {
    throw new Error("Download popup is only available in the browser runtime.");
  }

  const popup = window.open(
    "",
    "downloadPopup",
    "width=1080,height=760,menubar=no,toolbar=no,status=no,scrollbars=yes"
  );
  if (!popup) {
    throw new Error("Popup blocked. Please allow popups and try again.");
  }
  return popup;
}

function renderPopupLoading(popup: Window): void {
  popup.document.write(`<!DOCTYPE html><html><head><title>Download Sources</title><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{margin:0;background:#0b1220;color:#e5e7eb;font-family:Segoe UI,Helvetica,Arial,sans-serif;padding:16px} .card{border:1px solid #334155;border-radius:10px;padding:14px;background:#0f172a} .muted{color:#9ca3af}</style></head><body><div class="card"><h2 style="margin:0 0 8px;">Preparing download links...</h2><p class="muted" style="margin:0;">Decoding stream payload with WASM.</p></div></body></html>`);
  popup.document.close();
}

function renderPopupError(popup: Window, message: string): void {
  popup.document.write(`<!DOCTYPE html><html><head><title>Download Error</title><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{margin:0;background:#0b1220;color:#fca5a5;font-family:Segoe UI,Helvetica,Arial,sans-serif;padding:16px} .card{border:1px solid #7f1d1d;border-radius:10px;padding:14px;background:#1f2937} .muted{color:#cbd5e1;white-space:pre-wrap}</style></head><body><div class="card"><h2 style="margin:0 0 8px;">Failed to decode download links</h2><p class="muted" style="margin:0;">${message}</p></div></body></html>`);
  popup.document.close();
}

function renderPopupLinks(
  popup: Window,
  title: string,
  payload: { sources: SourceItem[]; subtitles: SubtitleItem[] }
): void {
  const sourceRows = payload.sources
    .map((src) => {
      const dlUrl = buildDownloadUrl(src.url, title || "video");
      return `<tr><td>${src.quality || "Unknown"}</td><td><a href="${src.url}" target="_blank" rel="noreferrer">Open</a></td><td><a href="${dlUrl}" target="_blank" rel="noreferrer">Download</a></td></tr>`;
    })
    .join("");

  const subtitleRows = payload.subtitles
    .map((sub) => {
      return `<tr><td>${sub.language || sub.label || "Unknown"}</td><td><a href="${sub.url}" target="_blank" rel="noreferrer">Open</a></td><td><a href="${sub.url}" target="_blank" rel="noreferrer">Download</a></td></tr>`;
    })
    .join("");

  popup.document.write(`<!DOCTYPE html><html><head><title>Download Sources</title><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{margin:0;background:#0b1220;color:#e5e7eb;font-family:Segoe UI,Helvetica,Arial,sans-serif;padding:16px} .card{border:1px solid #334155;border-radius:10px;padding:14px;background:#0f172a;margin-bottom:14px} .muted{color:#9ca3af} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #334155;padding:8px;text-align:left} a{color:#93c5fd;text-decoration:none} a:hover{text-decoration:underline}</style></head><body><div class="card"><h2 style="margin:0 0 8px;">${title}</h2><p class="muted" style="margin:0;">Decoded sources from Videasy endpoints</p></div><div class="card"><h3 style="margin-top:0;">Sources</h3><table><thead><tr><th>Quality</th><th>URL</th><th>Action</th></tr></thead><tbody>${sourceRows || "<tr><td colspan=\"3\">No sources</td></tr>"}</tbody></table></div><div class="card"><h3 style="margin-top:0;">Subtitles</h3><table><thead><tr><th>Language</th><th>URL</th><th>Action</th></tr></thead><tbody>${subtitleRows || "<tr><td colspan=\"3\">No subtitles</td></tr>"}</tbody></table></div></body></html>`);
  popup.document.close();
}

function readString(memory: WebAssembly.Memory, ptr: number): string {
  if (!ptr) return "";
  const len = (new Uint32Array(memory.buffer))[(ptr - 4) >>> 2] >>> 1;
  const end = (ptr + len * 2) >>> 1;
  const u16 = new Uint16Array(memory.buffer);
  let out = "";
  for (let i = ptr >>> 1; i < end; i += 2048) {
    const piece = u16.subarray(i, Math.min(end, i + 2048));
    let chunk = "";
    for (let j = 0; j < piece.length; j += 1) {
      chunk += String.fromCharCode(piece[j]);
    }
    out += chunk;
  }
  return out;
}

function writeString(
  instance: WebAssembly.Instance,
  memory: WebAssembly.Memory,
  str: string
): number {
  const exportsAny = instance.exports as any;
  const len = str.length;
  const ptr = exportsAny.__new(len << 1, 2) >>> 0;
  const u16 = new Uint16Array(memory.buffer);
  for (let i = 0; i < len; i += 1) {
    u16[(ptr >>> 1) + i] = str.charCodeAt(i);
  }
  return ptr;
}

async function getWasmApi(): Promise<WasmApi> {
  if (wasmApiPromise) return wasmApiPromise;

  wasmApiPromise = (async () => {
    let module: WebAssembly.Module;
    if (isBrowserRuntime()) {
      try {
        module = await WebAssembly.compileStreaming(fetch("/module.wasm"));
      } catch {
        const response = await fetch("/module.wasm");
        if (!response.ok) {
          throw new Error("Failed to load /module.wasm");
        }
        const bytes = await response.arrayBuffer();
        module = await WebAssembly.compile(bytes);
      }
    } else {
      const { readFile } = await import("fs/promises");
      const { resolve } = await import("path");

      try {
        // Vercel docs pattern: keep wasm at project root and read via process.cwd().
        const rootWasmPath = resolve(process.cwd(), "./module.wasm");
        const bytes = await readFile(rootWasmPath);
        module = await WebAssembly.compile(bytes);
      } catch {
        const serverWasmUrl = getServerWasmUrl();
        if (!serverWasmUrl) {
          throw new Error(
            "Failed to load module.wasm on server. Add ./module.wasm at project root or set VIDEASY_WASM_URL."
          );
        }

        const response = await fetch(serverWasmUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch server WASM at ${serverWasmUrl} -> ${response.status}`);
        }
        const bytes = await response.arrayBuffer();
        module = await WebAssembly.compile(bytes);
      }
    }

    const instance = await WebAssembly.instantiate(module, {
      env: {
        seed: () => Date.now() * Math.random(),
        abort(msgPtr: number, filePtr: number, line: number, col: number) {
          throw new Error(`WASM abort: ${msgPtr} @ ${filePtr}:${line}:${col}`);
        },
      },
    });

    const memory = (instance.exports as any).memory as WebAssembly.Memory;
    const exportsAny = instance.exports as any;

    return {
      serve: () => readString(memory, exportsAny.serve() >>> 0),
      verify: (hash: string) => {
        const ptr = writeString(instance, memory, hash);
        return exportsAny.verify(ptr) !== 0;
      },
      decrypt: (encrypted: string, tmdbId: number) => {
        const ptr = writeString(instance, memory, encrypted);
        return readString(memory, exportsAny.decrypt(ptr, tmdbId) >>> 0);
      },
    };
  })();

  return wasmApiPromise;
}

function waitForHash(timeoutMs = 5000): Promise<string> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const hash = (globalThis as any).hash;
      if (typeof hash === "string" && hash.length > 0) {
        resolve(hash);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Timed out waiting for window.hash"));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

async function decodePayload(
  encrypted: string,
  b35: string,
  tmdbId: number,
  logger?: DownloaderLogger
): Promise<DecodeResult> {
  logger?.("decode:start", {
    encryptedLength: encrypted.length,
    tmdbId,
  });
  const wasm = await getWasmApi();
  logger?.("decode:wasm-ready");
  (globalThis as any).hash = undefined;
  Function("globalThis", `const window = globalThis; ${wasm.serve()}`)(globalThis);
  const hash = await waitForHash();
  logger?.("decode:hash-ready", { hashLength: hash.length });
  const verifyPassed = wasm.verify(hash);
  logger?.("decode:hash-verified", { verifyPassed });

  const encryptedResult = wasm.decrypt(encrypted, tmdbId);
  logger?.("decode:decrypted", { decryptedLength: encryptedResult.length });
  const bytes = CryptoJS.AES.decrypt(encryptedResult, b35);
  const originalText = bytes.toString(CryptoJS.enc.Utf8);
  if (!originalText) {
    logger?.("decode:error", { reason: "empty-utf8-after-aes" });
    throw new Error("AES decrypt returned empty/invalid utf8");
  }

  const parsed = JSON.parse(originalText);
  const sourcesCount = Array.isArray(parsed?.sources) ? parsed.sources.length : 0;
  const subtitlesCount = Array.isArray(parsed?.subtitles)
    ? parsed.subtitles.length
    : 0;
  logger?.("decode:json-parsed", { sourcesCount, subtitlesCount });
  return parsed;
}

async function tryFetchByEndpoint(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  b35: string,
  tmdbId: number,
  logger?: DownloaderLogger
): Promise<DecodeResult> {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  logger?.("endpoint:request", {
    endpoint,
    url: url.toString(),
  });

  const res = await fetch(url.toString());
  logger?.("endpoint:response", {
    endpoint,
    status: res.status,
    ok: res.ok,
  });
  if (!res.ok) {
    throw new Error(`${endpoint} -> ${res.status}`);
  }

  const encrypted = await res.text();
  logger?.("endpoint:payload", {
    endpoint,
    encryptedLength: encrypted.length,
  });
  return decodePayload(encrypted, b35, tmdbId, logger);
}

async function getIpLocation(): Promise<{
  userLat?: number;
  userLng?: number;
}> {
  try {
    const res = await fetch("https://ip.cineby.gd");
    if (!res.ok) return {};
    const data = await res.json();
    return { userLat: data.latitude, userLng: data.longitude };
  } catch {
    return {};
  }
}

export function buildDownloadUrl(url: string, filenameBase: string): string {
  if (!url || !url.includes("/mp4/")) return url;
  const transformed = url.replace("/mp4/", "/download/");
  const encodedName = btoa(unescape(encodeURIComponent(`${filenameBase}.mp4`)));
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}filename=${encodedName}`;
}

export async function fetchVideasyDownloadData(input: DownloadRequest): Promise<{
  sources: SourceItem[];
  subtitles: SubtitleItem[];
}>;
export async function fetchVideasyDownloadData(
  input: DownloadRequest,
  options: FetchVideasyOptions
): Promise<{
  sources: SourceItem[];
  subtitles: SubtitleItem[];
}>;
export async function fetchVideasyDownloadData(
  input: DownloadRequest,
  options?: FetchVideasyOptions
): Promise<{
  sources: SourceItem[];
  subtitles: SubtitleItem[];
}> {
  const b35 = buildB35(input.tmdbId);
  const logger = options?.logger;
  logger?.("fetch:start", {
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    title: input.title,
    year: input.year,
    seasonId: input.seasonId,
    episodeId: input.episodeId,
    totalSeasons: input.totalSeasons,
    hasImdbId: Boolean(input.imdbId),
  });
  const params: Record<string, string | number | undefined> = {
    title: toMediaTitle(input),
    mediaType: input.mediaType,
    year: input.year,
    totalSeasons: input.totalSeasons,
    episodeId: input.mediaType === "tv" ? input.episodeId || 1 : 1,
    seasonId: input.mediaType === "tv" ? input.seasonId || 1 : 1,
    tmdbId: input.tmdbId,
    imdbId: input.imdbId || "",
  };
  logger?.("fetch:params-built", {
    title: params.title,
    mediaType: params.mediaType,
    year: params.year,
    totalSeasons: params.totalSeasons,
    episodeId: params.episodeId,
    seasonId: params.seasonId,
    tmdbId: params.tmdbId,
    hasImdbId: Boolean(params.imdbId),
  });

  const endpointFast = "https://api.videasy.net/downloader2/sources-with-title";
  const endpointSlow = "https://api.videasy.net/e3b0c442/sources-with-title";

  let decodedFast: DecodeResult | null = null;
  let fastError = "";
  try {
    decodedFast = await tryFetchByEndpoint(
      endpointFast,
      params,
      b35,
      input.tmdbId,
      logger
    );
    logger?.("fetch:fast-success", {
      sources: decodedFast.sources?.length || 0,
      subtitles: decodedFast.subtitles?.length || 0,
    });
  } catch (error: any) {
    decodedFast = null;
    fastError = String(error?.message || error || "unknown fast endpoint error");
    logger?.("fetch:fast-error", { error: fastError });
  }

  let decodedSlow: DecodeResult | null = null;
  let slowError = "";
  try {
    const loc = await getIpLocation();
    logger?.("fetch:geo", {
      hasUserLat: typeof loc.userLat === "number",
      hasUserLng: typeof loc.userLng === "number",
    });
    decodedSlow = await tryFetchByEndpoint(
      endpointSlow,
      { ...params, ...loc },
      b35,
      input.tmdbId,
      logger
    );
    logger?.("fetch:slow-success", {
      sources: decodedSlow.sources?.length || 0,
      subtitles: decodedSlow.subtitles?.length || 0,
    });
  } catch (error: any) {
    decodedSlow = null;
    slowError = String(error?.message || error || "unknown slow endpoint error");
    logger?.("fetch:slow-error", { error: slowError });
  }

  const merged = {
    sources: [
      ...((decodedFast?.sources || []).map((s) => ({
        ...s,
        quality: `${s.quality || "Unknown"} [Fast]`,
      })) as SourceItem[]),
      ...((decodedSlow?.sources || []).map((s) => ({
        ...s,
        quality: `${s.quality || "Unknown"} [Slow]`,
      })) as SourceItem[]),
    ],
    subtitles: [...(decodedFast?.subtitles || []), ...(decodedSlow?.subtitles || [])],
  };
  logger?.("fetch:merged", {
    sources: merged.sources.length,
    subtitles: merged.subtitles.length,
  });

  if (!merged.sources.length) {
    const details = [
      fastError ? `fast=${fastError}` : "fast=ok-but-empty",
      slowError ? `slow=${slowError}` : "slow=ok-but-empty",
    ].join("; ");
    logger?.("fetch:error", { reason: "no-sources", details });
    throw new Error(`No sources returned from either endpoint (${details})`);
  }

  logger?.("fetch:done", {
    sources: merged.sources.length,
    subtitles: merged.subtitles.length,
  });
  return merged;
}

export async function openVideasyDownloadPopup(input: DownloadRequest): Promise<void> {
  const popup = getPopup();
  renderPopupLoading(popup);

  try {
    const decoded = await fetchVideasyDownloadData(input);
    renderPopupLinks(popup, toMediaTitle(input), decoded);
  } catch (error: any) {
    renderPopupError(popup, String(error?.message || error));
    throw error;
  }
}
