const DEFAULT_DOWNLOAD_API_BASE = "https://downloads.shegu.st";

export type DownloadLink = {
  source: string;
  name: string;
  quality: number;
  url: string;
  size: string;
  provider: string;
  filename?: string;
};

type DownloadApiResponse = {
  links?: DownloadLink[];
  error?: string;
};

export type MediaDownloadRequest = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  season?: number;
  episode?: number;
};

function getDownloadApiBase(): string {
  return (process.env.NEXT_PUBLIC_DOWNLOAD_API_URL || DEFAULT_DOWNLOAD_API_BASE).replace(/\/$/, "");
}

function isDownloadLink(value: unknown): value is DownloadLink {
  if (!value || typeof value !== "object") return false;

  const link = value as Partial<DownloadLink>;
  return (
    typeof link.source === "string" &&
    typeof link.name === "string" &&
    typeof link.quality === "number" &&
    typeof link.url === "string" &&
    link.url.length > 0 &&
    typeof link.size === "string" &&
    typeof link.provider === "string" &&
    (link.filename === undefined || typeof link.filename === "string")
  );
}

function buildDownloadApiUrl(request: MediaDownloadRequest): string {
  const baseUrl = getDownloadApiBase();
  const tmdbId = encodeURIComponent(String(request.tmdbId));

  if (request.mediaType === "movie") {
    return `${baseUrl}/movie/${tmdbId}`;
  }

  const season = encodeURIComponent(String(request.season || 1));
  const episode = encodeURIComponent(String(request.episode || 1));
  return `${baseUrl}/tv/${tmdbId}/${season}/${episode}`;
}

export async function fetchDownloadLinks(
  request: MediaDownloadRequest,
  signal?: AbortSignal
): Promise<DownloadLink[]> {
  const response = await fetch(buildDownloadApiUrl(request), {
    signal,
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json().catch(() => null)) as DownloadApiResponse | null;
  if (!response.ok || !payload) {
    throw new Error(`Download lookup failed (${response.status}).`);
  }

  const links = Array.isArray(payload.links) ? payload.links.filter(isDownloadLink) : [];
  if (links.length === 0) {
    const mediaLabel = request.mediaType === "tv" ? "episode" : "movie";
    throw new Error(payload.error || `No direct downloads are available for this ${mediaLabel}.`);
  }

  return links.sort((a, b) => b.quality - a.quality);
}
