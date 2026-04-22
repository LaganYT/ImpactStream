import axios from "axios";

export type ContinueWatchingKind = "movie" | "tv" | "anime-movie" | "anime-tv";

export type ContinueWatchingProgress = {
  kind: ContinueWatchingKind;
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  timestamp: number;
  duration: number;
  progress: number;
  updatedAt: string;
};

export type ContinueWatchingItem = ContinueWatchingProgress & {
  title: string;
  posterPath?: string;
  releaseDate?: string;
  voteAverage?: number;
};

const CONTINUE_PREFIX = "continue:";

const toValidNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const readContinueWatchingProgress = (): ContinueWatchingProgress[] => {
  if (typeof window === "undefined") return [];

  const entries: ContinueWatchingProgress[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(CONTINUE_PREFIX)) continue;

    const keyParts = key.split(":");
    let kind: ContinueWatchingKind | null = null;
    let id = "";

    if (keyParts[1] === "movie" && keyParts[2]) {
      kind = "movie";
      id = keyParts[2];
    } else if (keyParts[1] === "tv" && keyParts[2]) {
      kind = "tv";
      id = keyParts[2];
    } else if (keyParts[1] === "anime" && keyParts[2] && keyParts[3]) {
      kind = keyParts[2] === "movie" ? "anime-movie" : "anime-tv";
      id = keyParts[3];
    }

    if (!kind || !id) continue;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      const timestamp = Math.max(0, Math.floor(toValidNumber(parsed.timestamp)));
      const duration = Math.max(0, Math.floor(toValidNumber(parsed.duration)));
      const progress = Math.max(0, Math.min(100, toValidNumber(parsed.progress)));
      const seasonNumber = Math.max(1, Math.floor(toValidNumber(parsed.seasonNumber, 1)));
      const episodeNumber = Math.max(1, Math.floor(toValidNumber(parsed.episodeNumber, 1)));
      const updatedAt = String(parsed.updatedAt || "");

      if (timestamp <= 0 && progress <= 0) continue;

      entries.push({
        kind,
        id,
        seasonNumber,
        episodeNumber,
        timestamp,
        duration,
        progress,
        updatedAt,
      });
    } catch {
      // Ignore invalid entries.
    }
  }

  return entries.sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || "") || 0;
    const bTime = Date.parse(b.updatedAt || "") || 0;
    return bTime - aTime;
  });
};

const detailsEndpoint = (kind: ContinueWatchingKind, id: string) => {
  if (kind === "movie" || kind === "anime-movie") return `https://api.themoviedb.org/3/movie/${id}`;
  return `https://api.themoviedb.org/3/tv/${id}`;
};

export const hydrateContinueWatchingItems = async (
  entries: ContinueWatchingProgress[]
): Promise<ContinueWatchingItem[]> => {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey || entries.length === 0) return [];

  const hydrated = await Promise.all(
    entries.map(async (entry) => {
      try {
        const { data } = await axios.get(detailsEndpoint(entry.kind, entry.id), {
          params: { api_key: apiKey },
        });

        return {
          ...entry,
          title: data.title || data.name || "Untitled",
          posterPath: data.poster_path,
          releaseDate: data.release_date || data.first_air_date,
          voteAverage: data.vote_average,
        } as ContinueWatchingItem;
      } catch {
        return {
          ...entry,
          title: "Untitled",
        } as ContinueWatchingItem;
      }
    })
  );

  return hydrated;
};

export const continueWatchingHref = (item: ContinueWatchingProgress | ContinueWatchingItem) => {
  if (item.kind === "movie") return `/movie/${item.id}`;
  if (item.kind === "tv") return `/tv/${item.id}`;
  if (item.kind === "anime-movie") return `/anime/${item.id}?type=movie`;
  return `/anime/${item.id}?type=tv`;
};
