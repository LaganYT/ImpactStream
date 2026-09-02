const DEFAULT_DOWNLOAD_API_BASE = "https://downloads.shegu.st";

export type SheguDownloadLink = {
  source: string;
  name: string;
  quality: number;
  url: string;
  size: string;
  provider: string;
};

type SheguDownloadResponse = {
  links?: SheguDownloadLink[];
  error?: string;
};

export type SheguDownloadRequest = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
};

function getDownloadApiBase(): string {
  return (process.env.NEXT_PUBLIC_DOWNLOAD_API_URL || DEFAULT_DOWNLOAD_API_BASE).replace(/\/$/, "");
}

function isValidDownloadLink(value: unknown): value is SheguDownloadLink {
  if (!value || typeof value !== "object") return false;
  const link = value as Partial<SheguDownloadLink>;
  return (
    typeof link.source === "string" &&
    typeof link.name === "string" &&
    typeof link.quality === "number" &&
    typeof link.url === "string" &&
    link.url.length > 0 &&
    typeof link.size === "string" &&
    typeof link.provider === "string"
  );
}

function buildDownloadUrl(request: SheguDownloadRequest): string {
  const base = getDownloadApiBase();
  const id = encodeURIComponent(String(request.tmdbId));

  if (request.mediaType === "movie") {
    return `${base}/movie/${id}`;
  }

  const season = encodeURIComponent(String(request.season || 1));
  const episode = encodeURIComponent(String(request.episode || 1));
  return `${base}/tv/${id}/${season}/${episode}`;
}

export async function fetchSheguDownloadLinks(
  request: SheguDownloadRequest,
  signal?: AbortSignal
): Promise<SheguDownloadLink[]> {
  const response = await fetch(buildDownloadUrl(request), {
    signal,
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json().catch(() => null)) as SheguDownloadResponse | null;
  if (!response.ok || !payload) {
    throw new Error(`Download lookup failed (${response.status}).`);
  }

  const links = Array.isArray(payload.links) ? payload.links.filter(isValidDownloadLink) : [];
  if (links.length === 0) {
    const label = request.mediaType === "tv" ? "episode" : "movie";
    throw new Error(payload.error || `No direct downloads are available for this ${label}.`);
  }

  return links.sort((a, b) => b.quality - a.quality);
}
