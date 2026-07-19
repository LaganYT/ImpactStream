export const VIDNEST_ORIGIN = "https://vidnest.fun";

type MediaKind = "movie" | "tv";

type VidnestProgress = {
  watched?: number;
  duration?: number;
};

type VidnestMediaEntry = {
  id?: number | string;
  type?: MediaKind | "anime";
  progress?: VidnestProgress;
  last_season_watched?: number | string;
  last_episode_watched?: number | string;
  show_progress?: Record<string, {
    season?: number | string;
    episode?: number | string;
    progress?: VidnestProgress;
  }>;
};

export type ContinueProgressPayload = {
  timestamp: number;
  duration: number;
  progress: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export function buildVidnestMovieUrl(tmdbId: string, resumeSeconds = 0) {
  const query = new URLSearchParams();
  if (resumeSeconds > 0) query.set("progress", String(resumeSeconds));
  return `${VIDNEST_ORIGIN}/movie/${tmdbId}${withQuery(query)}`;
}

export function buildVidnestTvUrl(tmdbId: string, season: number, episode: number, resumeSeconds = 0) {
  const query = new URLSearchParams();
  if (resumeSeconds > 0) query.set("progress", String(resumeSeconds));
  return `${VIDNEST_ORIGIN}/tv/${tmdbId}/${season}/${episode}${withQuery(query)}`;
}

export function parseVidnestMessageData(data: unknown) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data && typeof data === "object" ? data : null;
}

export function logVidnestPlayerEvent(data: unknown) {
  if (!data || typeof data !== "object") return;

  const playerData = data as { event?: string; currentTime?: number; duration?: number };
  if (!playerData.event) return;

  console.log(
    `Player ${playerData.event} at ${Number(playerData.currentTime || 0)}s of ${Number(
      playerData.duration || 0
    )}s`
  );
}

export function getVidnestMediaEntry(
  mediaData: unknown,
  mediaId: string | number
): VidnestMediaEntry | null {
  if (!mediaData || typeof mediaData !== "object") return null;

  const byId = (mediaData as Record<string, VidnestMediaEntry>)[String(mediaId)];
  if (byId) return byId;

  const values = Object.values(mediaData as Record<string, VidnestMediaEntry>);
  return values.find((entry) => String(entry?.id) === String(mediaId)) || null;
}

export function toContinueProgress(
  entry: VidnestMediaEntry,
  fallbackSeason = 1,
  fallbackEpisode = 1
): ContinueProgressPayload {
  const seasonNumber = Number(entry.last_season_watched || fallbackSeason) || fallbackSeason;
  const episodeNumber = Number(entry.last_episode_watched || fallbackEpisode) || fallbackEpisode;
  const episodeProgress =
    entry.show_progress?.[`s${seasonNumber}e${episodeNumber}`]?.progress || entry.progress || {};
  const watched = Math.max(0, Number(episodeProgress.watched || 0));
  const duration = Math.max(0, Number(episodeProgress.duration || 0));

  return {
    timestamp: Math.floor(watched),
    duration: Math.floor(duration),
    progress: duration > 0 ? Math.max(0, Math.min(100, (watched / duration) * 100)) : 0,
    seasonNumber,
    episodeNumber,
  };
}

function withQuery(query: URLSearchParams) {
  const value = query.toString();
  return value ? `?${value}` : "";
}
