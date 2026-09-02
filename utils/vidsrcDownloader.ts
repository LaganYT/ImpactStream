const DEFAULT_API_BASE = "https://vidsrc-scraper-serverless.vercel.app";

type MediaType = "movie" | "tv";

type ExtractResult = {
  hls_url?: string | null;
  error?: string | null;
};

type ExtractResponse = {
  success?: boolean;
  error?: string;
  results?: Record<string, ExtractResult>;
};

export type VidsrcDownloadRequest = {
  tmdbId: number;
  mediaType: MediaType;
  season?: number;
  episode?: number;
};

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_VIDSRC_API_URL || DEFAULT_API_BASE).replace(/\/$/, "");
}

function findStream(payload: ExtractResponse): string | null {
  for (const result of Object.values(payload.results || {})) {
    if (typeof result?.hls_url === "string" && result.hls_url.length > 0) {
      return result.hls_url;
    }
  }
  return null;
}

export async function extractVidsrcStream(input: VidsrcDownloadRequest): Promise<string> {
  const url = new URL(`${getApiBase()}/extract`);
  url.searchParams.set("tmdb_id", String(input.tmdbId));
  url.searchParams.set("type", input.mediaType);

  if (input.mediaType === "tv") {
    url.searchParams.set("season", String(input.season || 1));
    url.searchParams.set("episode", String(input.episode || 1));
  }

  const response = await fetch(url.toString());
  const payload = (await response.json().catch(() => null)) as ExtractResponse | null;
  if (!response.ok || !payload) {
    throw new Error(`Stream extraction failed (${response.status}).`);
  }

  const stream = findStream(payload);
  if (!payload.success || !stream) {
    const providerError = Object.values(payload.results || {}).find((item) => item?.error)?.error;
    throw new Error(payload.error || providerError || "The API did not return a downloadable stream.");
  }

  return stream;
}

export async function openVidsrcDownloader(input: VidsrcDownloadRequest): Promise<void> {
  const popup = window.open("", "_blank");
  if (!popup) {
    throw new Error("Your browser blocked the download window. Allow popups and try again.");
  }

  popup.document.title = "Preparing download";
  popup.document.body.style.cssText =
    "margin:0;padding:32px;background:#0b0b0f;color:#fff;font:16px system-ui,sans-serif";
  popup.document.body.textContent = "Extracting the HLS stream...";

  try {
    const streamUrl = await extractVidsrcStream(input);
    const converterUrl = new URL(`${getApiBase()}/convert`);
    converterUrl.searchParams.set("url", streamUrl);
    popup.location.replace(converterUrl.toString());
  } catch (error) {
    popup.document.body.textContent =
      error instanceof Error ? error.message : "The download could not be prepared.";
    throw error;
  }
}
