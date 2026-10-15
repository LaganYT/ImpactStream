export const VIDY_ORIGIN = "https://www.vidy.st";

type VidyMediaType = "movie" | "tv";

type VidyProgress = {
  watched?: number;
  duration?: number;
};

type VidyMediaEntry = {
  progress?: VidyProgress;
  last_season_watched?: number | string;
  last_episode_watched?: number | string;
  show_progress?: Record<
    string,
    {
      season?: number | string;
      episode?: number | string;
      progress?: VidyProgress;
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

export function buildVidyMovieUrl(tmdbId: string, resumeSeconds = 0) {
  const query = new URLSearchParams({ autoplay: "true" });
  if (resumeSeconds > 0) query.set("progress", String(resumeSeconds));
  return `${VIDY_ORIGIN}/movie/${tmdbId}${appendQueryString(query)}`;
}

export function buildVidyTvUrl(
  tmdbId: string,
  season: number,
  episode: number,
  resumeSeconds = 0,
  autoNext = true
) {
  const query = new URLSearchParams({
    autoplay: "true",
    nextEpisode: "true",
    autoplayNextEpisode: String(autoNext),
  });
  if (resumeSeconds > 0) query.set("progress", String(resumeSeconds));
  return `${VIDY_ORIGIN}/tv/${tmdbId}/${season}/${episode}${appendQueryString(query)}`;
}

// Vidy posts JSON strings; MEDIA_DATA's `data` is itself the serialized watch history.
export function parseVidyMessageData(data: unknown) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data && typeof data === "object" ? data : null;
}

// History is keyed `${mediaType}-${tmdbId}`.
export function getVidyMediaEntry(
  mediaData: unknown,
  mediaType: VidyMediaType,
  mediaId: string | number
): VidyMediaEntry | null {
  const history = parseVidyMessageData(mediaData) as Record<string, VidyMediaEntry> | null;
  return history?.[`${mediaType}-${mediaId}`] || null;
}

export function toContinueProgress(
  entry: VidyMediaEntry,
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
