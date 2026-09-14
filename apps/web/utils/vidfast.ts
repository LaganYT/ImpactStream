export const VIDFAST_ORIGIN = "https://vidfast.vc";

type MediaKind = "movie" | "tv";

type VidfastProgress = {
  watched?: number;
  duration?: number;
};

type VidfastMediaEntry = {
  id?: number | string;
  type?: MediaKind | "anime";
  progress?: VidfastProgress;
  last_season_watched?: number | string;
  last_episode_watched?: number | string;
  show_progress?: Record<string, {
    season?: number | string;
    episode?: number | string;
    progress?: VidfastProgress;
  }>;
};

export type ContinueProgressPayload = {
  timestamp: number;
  duration: number;
  progress: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

export function buildVidfastMovieUrl(tmdbId: string, resumeSeconds = 0) {
  const query = new URLSearchParams();
  query.set("autoPlay", "true");
  if (resumeSeconds > 0) query.set("startAt", String(resumeSeconds));
  return `${VIDFAST_ORIGIN}/movie/${tmdbId}${withQuery(query)}`;
}

export function buildVidfastTvUrl(tmdbId: string, season: number, episode: number, resumeSeconds = 0) {
  const query = new URLSearchParams();
  query.set("autoPlay", "true");
  query.set("nextButton", "true");
  query.set("autoNext", "true");
  if (resumeSeconds > 0) query.set("startAt", String(resumeSeconds));
  return `${VIDFAST_ORIGIN}/tv/${tmdbId}/${season}/${episode}${withQuery(query)}`;
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

export function logVidfastPlayerEvent(data: unknown) {
  if (!data || typeof data !== "object") return;

  const playerData = data as { event?: string; currentTime?: number; duration?: number };
  if (!playerData.event) return;

  console.log(
    `Player ${playerData.event} at ${Number(playerData.currentTime || 0)}s of ${Number(
      playerData.duration || 0
    )}s`
  );
}

export function getVidfastMediaEntry(
  mediaData: unknown,
  mediaId: string | number
): VidfastMediaEntry | null {
  if (!mediaData || typeof mediaData !== "object") return null;

  const byId = (mediaData as Record<string, VidfastMediaEntry>)[String(mediaId)];
  if (byId) return byId;

  const values = Object.values(mediaData as Record<string, VidfastMediaEntry>);
  return values.find((entry) => String(entry?.id) === String(mediaId)) || null;
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
