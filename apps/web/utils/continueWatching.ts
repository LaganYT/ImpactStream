export type ContinueMediaType = "movie" | "tv" | "anime:movie" | "anime:tv";

export type StoredProgress = {
  seasonNumber?: number;
  episodeNumber?: number;
  timestamp?: number;
  duration?: number;
  progress?: number;
  updatedAt?: string;
  title?: string;
  posterPath?: string;
  mediaType?: string;
  tmdbId?: string;
};

export type ContinueWatchingEntry = {
  key: string;
  tmdbId: string;
  mediaType: ContinueMediaType;
  title: string;
  posterPath: string | null;
  progress: number;
  timestamp: number;
  duration: number;
  seasonNumber?: number;
  episodeNumber?: number;
  updatedAt: string;
};

const INDEX_KEY = "continueWatching:index";
const MAX_INDEX_ENTRIES = 50;

// Index entries look like `movie:123`, `tv:123`, or `anime:tv:123`; each one's
// progress lives under `continue:<entry>`.
export function getContinueKey(mediaType: ContinueMediaType, tmdbId: string) {
  return `${mediaType}:${tmdbId}`;
}

export function isEpisodicType(mediaType: ContinueMediaType) {
  return mediaType === "tv" || mediaType === "anime:tv";
}

export function parseContinueKey(
  key: string
): { mediaType: ContinueMediaType; tmdbId: string } | null {
  const parts = key.split(":");
  if ((parts[0] === "movie" || parts[0] === "tv") && parts[1]) {
    return { mediaType: parts[0], tmdbId: parts[1] };
  }
  if (parts[0] === "anime" && (parts[1] === "movie" || parts[1] === "tv") && parts[2]) {
    return { mediaType: `anime:${parts[1]}`, tmdbId: parts[2] };
  }
  return null;
}

export function getResumeRoute(entry: Pick<ContinueWatchingEntry, "mediaType" | "tmdbId">) {
  const { mediaType, tmdbId } = entry;
  if (mediaType === "anime:movie") return `/anime/${tmdbId}?type=movie`;
  if (mediaType === "anime:tv") return `/anime/${tmdbId}?type=tv`;
  return `/${mediaType}/${tmdbId}`;
}

function readJson<T>(storageKey: string): T | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function readIndex(): string[] {
  const index = readJson<unknown>(INDEX_KEY);
  return Array.isArray(index) ? index.filter((entry) => typeof entry === "string") : [];
}

export function readProgress(key: string): StoredProgress | null {
  return readJson<StoredProgress>(`continue:${key}`);
}

// Movies are listed as soon as they're opened; episodic titles only once the
// viewer has made progress or moved past S1E1.
function shouldListInIndex(mediaType: ContinueMediaType, progress: StoredProgress) {
  if (!isEpisodicType(mediaType)) return true;

  return (
    Number(progress.timestamp || 0) > 0 ||
    Number(progress.progress || 0) > 0 ||
    Number(progress.seasonNumber || 1) !== 1 ||
    Number(progress.episodeNumber || 1) !== 1
  );
}

export function writeProgress(key: string, progress: StoredProgress) {
  const parsedKey = parseContinueKey(key);
  if (!parsedKey) return;

  try {
    window.localStorage.setItem(`continue:${key}`, JSON.stringify(progress));

    const index = readIndex().filter((entry) => entry !== key);
    if (shouldListInIndex(parsedKey.mediaType, progress)) index.unshift(key);
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_INDEX_ENTRIES)));
  } catch {}
}

export function removeProgress(key: string) {
  try {
    window.localStorage.removeItem(`continue:${key}`);
    window.localStorage.setItem(
      INDEX_KEY,
      JSON.stringify(readIndex().filter((entry) => entry !== key))
    );
  } catch {}
}

export function listContinueWatching(): ContinueWatchingEntry[] {
  const entries: ContinueWatchingEntry[] = [];

  for (const key of readIndex()) {
    const parsedKey = parseContinueKey(key);
    const stored = parsedKey ? readProgress(key) : null;
    if (!parsedKey || !stored?.title) continue;

    entries.push({
      key,
      ...parsedKey,
      title: stored.title,
      posterPath: stored.posterPath || null,
      progress: Number(stored.progress || 0),
      timestamp: Number(stored.timestamp || 0),
      duration: Number(stored.duration || 0),
      seasonNumber: stored.seasonNumber,
      episodeNumber: stored.episodeNumber,
      updatedAt: stored.updatedAt || "",
    });
  }

  return entries;
}
