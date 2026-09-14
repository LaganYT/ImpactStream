export const VIDFAST_UPSTREAM_ORIGIN = "https://vidfast.vc";
export const VIDFAST_ORIGIN =
  typeof window === "undefined" ? VIDFAST_UPSTREAM_ORIGIN : window.location.origin;
export const VIDFAST_PROXY_PREFIX = "/api/vidfast-proxy";

type VidfastMediaType = "movie" | "tv";

type VidfastProgress = {
  watched?: number;
  duration?: number;
};

type VidfastMediaEntry = {
  id?: number | string;
  type?: VidfastMediaType | "anime";
  progress?: VidfastProgress;
  last_season_watched?: number | string;
  last_episode_watched?: number | string;
  show_progress?: Record<
    string,
    {
      season?: number | string;
      episode?: number | string;
      progress?: VidfastProgress;
    }
  >;
};

export type ContinueProgressPayload = {
  timestamp: number;
  duration: number;
  progress: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export function buildVidfastMovieUrl(tmdbId: string, resumeSeconds = 0) {
  const query = new URLSearchParams({ autoPlay: "true" });
  if (resumeSeconds > 0) query.set("startAt", String(resumeSeconds));
  return `${VIDFAST_PROXY_PREFIX}/movie/${tmdbId}${appendQueryString(query)}`;
}

export function buildVidfastTvUrl(
  tmdbId: string,
  season: number,
  episode: number,
  resumeSeconds = 0
) {
  const query = new URLSearchParams({
    autoPlay: "true",
    nextButton: "true",
    autoNext: "true",
  });
  if (resumeSeconds > 0) query.set("startAt", String(resumeSeconds));
  return `${VIDFAST_PROXY_PREFIX}/tv/${tmdbId}/${season}/${episode}${appendQueryString(query)}`;
}

export function isVidfastMessageOrigin(origin: string) {
  return origin === VIDFAST_ORIGIN || origin === VIDFAST_UPSTREAM_ORIGIN;
}

export function parseVidfastMessageData(data: unknown) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data && typeof data === "object" ? data : null;
}

export function getVidfastMediaEntry(
  mediaData: unknown,
  mediaId: string | number
): VidfastMediaEntry | null {
  if (!mediaData || typeof mediaData !== "object") return null;

  const entriesById = mediaData as Record<string, VidfastMediaEntry>;
  const directEntry = entriesById[String(mediaId)];
  if (directEntry) return directEntry;

  return (
    Object.values(entriesById).find((entry) => String(entry?.id) === String(mediaId)) || null
  );
}

export function toContinueProgress(
  entry: VidfastMediaEntry,
  fallbackSeason = 1,
  fallbackEpisode = 1
): ContinueProgressPayload {
  const seasonNumber = Number(entry.last_season_watched || fallbackSeason) || fallbackSeason;
  const episodeNumber = Number(entry.last_episode_watched || fallbackEpisode) || fallbackEpisode;
  const episodeProgress =
    entry.show_progress?.[`s${seasonNumber}e${episodeNumber}`]?.progress || entry.progress || {};
  const watchedSeconds = Math.max(0, Number(episodeProgress.watched || 0));
  const durationSeconds = Math.max(0, Number(episodeProgress.duration || 0));

  return {
    timestamp: Math.floor(watchedSeconds),
    duration: Math.floor(durationSeconds),
    progress:
      durationSeconds > 0
        ? Math.max(0, Math.min(100, (watchedSeconds / durationSeconds) * 100))
        : 0,
    seasonNumber,
    episodeNumber,
  };
}

function appendQueryString(query: URLSearchParams) {
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}
