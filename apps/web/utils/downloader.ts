const DEFAULT_DOWNLOAD_API_URL = "https://hahaevilcraft.site/download-api/scrape/source";

export type DownloadLink = {
  name: string;
  quality: number;
  url: string;
  size: string;
  provider: string;
};

export type MediaDownloadRequest = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  season?: number;
  episode?: number;
};

type DownloadEvent = {
  quality?: string;
  url?: string;
  filename?: string;
  size?: string;
  provider?: string;
};

function getDownloadApiUrl(): string {
  return process.env.NEXT_PUBLIC_DOWNLOAD_API_URL || DEFAULT_DOWNLOAD_API_URL;
}

function buildDownloadApiUrl(request: MediaDownloadRequest): string {
  const query = new URLSearchParams({
    id: "4khdhub",
    tmdbId: String(request.tmdbId),
    type: request.mediaType,
    title: request.title,
  });

  if (request.mediaType === "tv") {
    query.set("season", String(request.season || 1));
    query.set("episode", String(request.episode || 1));
  }

  return `${getDownloadApiUrl()}?${query}`;
}

// "1080P" -> 1080, "4K" -> 2160
function parseQuality(value: string | undefined): number {
  if (value?.toUpperCase() === "4K") return 2160;
  return Number.parseInt(value || "", 10) || 0;
}

function toDownloadLink(event: DownloadEvent): DownloadLink | null {
  if (!event.url) return null;

  return {
    name: event.filename || event.url,
    quality: parseQuality(event.quality),
    url: event.url,
    size: event.size || "",
    provider: event.provider || "",
  };
}

// The API streams one server-sent event per link and ends with `[DONE]`. Links
// go straight from the browser to the file hosts; nothing is proxied. `onUpdate`
// receives the sorted list each time a new link arrives.
export function fetchDownloadLinks(
  request: MediaDownloadRequest,
  signal: AbortSignal,
  onUpdate: (links: DownloadLink[]) => void
): Promise<DownloadLink[]> {
  return new Promise((resolve, reject) => {
    const links: DownloadLink[] = [];
    const source = new EventSource(buildDownloadApiUrl(request));

    const finish = (error?: Error) => {
      source.close();
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else if (links.length > 0) resolve(links);
      else {
        const mediaLabel = request.mediaType === "tv" ? "episode" : "movie";
        reject(new Error(`No direct downloads are available for this ${mediaLabel}.`));
      }
    };
    const onAbort = () => finish(new DOMException("Aborted", "AbortError"));

    signal.addEventListener("abort", onAbort);

    source.onmessage = (message) => {
      if (message.data === "[DONE]") return finish();

      try {
        const link = toDownloadLink(JSON.parse(message.data));
        if (!link || links.some((existing) => existing.url === link.url)) return;
        links.push(link);
        links.sort((a, b) => b.quality - a.quality);
        onUpdate([...links]);
      } catch {}
    };

    // EventSource would otherwise reconnect and replay the whole scrape.
    source.onerror = () =>
      finish(links.length > 0 ? undefined : new Error("Download service is unavailable."));
  });
}
