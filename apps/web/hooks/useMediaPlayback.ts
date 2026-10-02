import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeInfo } from "../components/EpisodeList";
import {
  ContinueMediaType,
  getContinueKey,
  isEpisodicType,
  readProgress,
  StoredProgress,
  writeProgress,
} from "../utils/continueWatching";
import { tmdbFetch } from "../utils/tmdbClient";
import {
  buildVidfastMovieUrl,
  buildVidfastTvUrl,
  getVidfastMediaEntry,
  parseVidfastMessageData,
  toContinueProgress,
  VIDFAST_ORIGIN,
} from "../utils/vidfast";

export type PlaybackDetails = {
  title?: string;
  name?: string;
  poster_path?: string;
  number_of_seasons?: number;
  seasons?: { season_number: number; episode_count?: number }[];
};

type UseMediaPlaybackOptions = {
  tmdbId: string | undefined;
  mediaType: ContinueMediaType;
  initialSeason?: number;
  initialEpisode?: number;
};

export type EpisodeRef = { season: number; episode: number };

const sameEpisode = (a: EpisodeRef, b: EpisodeRef) =>
  a.season === b.season && a.episode === b.episode;

// Shared state for the movie, TV, and anime watch pages: loads TMDB details,
// restores and persists continue-watching progress, tracks the active episode,
// and builds the Vidfast embed URL.
export function useMediaPlayback({
  tmdbId,
  mediaType,
  initialSeason,
  initialEpisode,
}: UseMediaPlaybackOptions) {
  const isEpisodic = isEpisodicType(mediaType);
  const tmdbType = isEpisodic ? "tv" : "movie";
  const progressKey = tmdbId ? getContinueKey(mediaType, tmdbId) : null;

  const [details, setDetails] = useState<PlaybackDetails | null>(null);
  // `current` follows whatever the player reports; `loaded` is what the iframe
  // was opened with. Keeping them apart means the player advancing on its own
  // doesn't force an iframe reload.
  const [current, setCurrent] = useState<EpisodeRef>({ season: 1, episode: 1 });
  const [loaded, setLoaded] = useState<EpisodeRef>({ season: 1, episode: 1 });
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(null);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [endedEpisode, setEndedEpisode] = useState<EpisodeRef | null>(null);

  const detailsRef = useRef(details);
  detailsRef.current = details;
  const currentRef = useRef(current);
  currentRef.current = current;

  const title = details?.title || details?.name || "Untitled";

  useEffect(() => {
    if (!tmdbId) return;

    let cancelled = false;
    setDetails(null);
    tmdbFetch<PlaybackDetails>(`${tmdbType}/${tmdbId}`)
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [tmdbId, tmdbType]);

  // Restore the saved episode (query params win), then remember where to resume.
  useEffect(() => {
    if (!progressKey) return;

    const stored = readProgress(progressKey) || {};
    const pick = (...values: (number | undefined)[]) =>
      values.find((value) => Number.isFinite(value) && Number(value) > 0) || 1;

    const restored = isEpisodic
      ? {
          season: pick(initialSeason, Number(stored.seasonNumber)),
          episode: pick(initialEpisode, Number(stored.episodeNumber)),
        }
      : { season: 1, episode: 1 };

    setCurrent(restored);
    setLoaded(restored);
    setIsProgressLoaded(true);
  }, [progressKey, isEpisodic, initialSeason, initialEpisode]);

  useEffect(() => {
    if (!progressKey || !isProgressLoaded) return;

    const stored = readProgress(progressKey);
    const isSavedEpisode =
      !isEpisodic ||
      (Number(stored?.seasonNumber) === loaded.season &&
        Number(stored?.episodeNumber) === loaded.episode);
    const savedTimestamp = Math.floor(Number(stored?.timestamp || 0));
    setResumeSeconds(isSavedEpisode && savedTimestamp > 0 ? savedTimestamp : 0);
  }, [progressKey, isEpisodic, isProgressLoaded, loaded.season, loaded.episode]);

  useEffect(() => {
    if (!isEpisodic || !tmdbId || !isProgressLoaded) return;

    let cancelled = false;
    setEpisodes(null);
    tmdbFetch<{ episodes?: EpisodeInfo[] }>(`tv/${tmdbId}/season/${current.season}`)
      .then((data) => {
        if (cancelled) return;
        const seasonEpisodes = Array.isArray(data.episodes) ? data.episodes : [];
        setEpisodes(seasonEpisodes);
        const clamp = (ref: EpisodeRef) =>
          ref.season === current.season &&
          ref.episode > seasonEpisodes.length &&
          seasonEpisodes.length > 0
            ? { ...ref, episode: 1 }
            : ref;
        setCurrent(clamp);
        setLoaded(clamp);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isEpisodic, tmdbId, isProgressLoaded, current.season]);

  const saveProgress = useCallback(
    (update: (stored: StoredProgress) => StoredProgress) => {
      if (!progressKey || !tmdbId) return;

      const stored = readProgress(progressKey) || {};
      const latestDetails = detailsRef.current;
      writeProgress(progressKey, {
        ...update(stored),
        title: latestDetails?.title || latestDetails?.name || stored.title,
        posterPath: latestDetails?.poster_path || stored.posterPath,
        mediaType,
        tmdbId,
      });
    },
    [progressKey, tmdbId, mediaType]
  );

  // Record title metadata once details arrive so Continue Watching can render it.
  useEffect(() => {
    if (!details) return;
    saveProgress((stored) => ({
      ...stored,
      updatedAt: stored.updatedAt || new Date().toISOString(),
    }));
  }, [details, saveProgress]);

  // Persist the selected episode; switching episodes resets saved progress.
  useEffect(() => {
    if (!isEpisodic || !isProgressLoaded) return;

    saveProgress((stored) => {
      const sameEpisode =
        Number(stored.seasonNumber) === current.season &&
        Number(stored.episodeNumber) === current.episode;
      return {
        ...stored,
        seasonNumber: current.season,
        episodeNumber: current.episode,
        timestamp: sameEpisode ? Math.max(0, Math.floor(Number(stored.timestamp || 0))) : 0,
        progress: sameEpisode ? Math.max(0, Math.min(100, Number(stored.progress || 0))) : 0,
        duration: sameEpisode ? stored.duration : 0,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [isEpisodic, isProgressLoaded, current.season, current.episode, saveProgress]);

  useEffect(() => {
    if (!tmdbId || !isProgressLoaded) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== VIDFAST_ORIGIN) return;

      const message = parseVidfastMessageData(event.data) as {
        type?: string;
        data?: { event?: string } & Record<string, unknown>;
      } | null;
      if (!message) return;

      if (message.type === "PLAYER_EVENT" && message.data?.event === "ended") {
        setEndedEpisode(currentRef.current);
        return;
      }

      if (message.type !== "MEDIA_DATA") return;

      window.localStorage.setItem("vidFastProgress", JSON.stringify(message.data));

      const mediaEntry = getVidfastMediaEntry(message.data, tmdbId);
      if (!mediaEntry || mediaEntry.type !== tmdbType) return;

      const { season, episode } = currentRef.current;
      const next = toContinueProgress(mediaEntry, season, episode);
      const nextSeason = isEpisodic ? next.seasonNumber || season : 1;
      const nextEpisode = isEpisodic ? next.episodeNumber || episode : 1;

      // Vidfast can advance episodes on its own (autoNext); follow it.
      if (isEpisodic && (nextSeason !== season || nextEpisode !== episode)) {
        setCurrent({ season: nextSeason, episode: nextEpisode });
      }

      saveProgress(() => ({
        seasonNumber: nextSeason,
        episodeNumber: nextEpisode,
        timestamp: next.timestamp,
        duration: next.duration,
        progress: next.progress,
        updatedAt: new Date().toISOString(),
      }));
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [tmdbId, tmdbType, isEpisodic, isProgressLoaded, saveProgress]);

  const seasonNumbers = useMemo(() => {
    const fromDetails = (details?.seasons || [])
      .map((season) => season.season_number)
      .filter((season) => season > 0);
    if (fromDetails.length > 0) return fromDetails;
    return Array.from({ length: details?.number_of_seasons || 1 }, (_, index) => index + 1);
  }, [details]);

  const nextEpisode = useMemo<EpisodeRef | null>(() => {
    if (!isEpisodic || !episodes) return null;
    if (current.episode < episodes.length) {
      return { season: current.season, episode: current.episode + 1 };
    }
    const nextSeason = seasonNumbers.find((season) => season > current.season);
    return nextSeason ? { season: nextSeason, episode: 1 } : null;
  }, [isEpisodic, episodes, current, seasonNumbers]);

  const selectEpisode = useCallback((ref: EpisodeRef) => {
    setCurrent(ref);
    setLoaded(ref);
    setEndedEpisode(null);
  }, []);

  // The "up next" prompt only applies while the ended episode is still current;
  // if the player auto-advanced by itself, `current` has already moved on.
  const showUpNext = Boolean(endedEpisode && sameEpisode(endedEpisode, current) && nextEpisode);
  const dismissUpNext = useCallback(() => setEndedEpisode(null), []);

  const currentEpisodeInfo = episodes?.find(
    (episode) => episode.episode_number === current.episode
  );

  // Once playback has started, stay ready while a new season's episodes load so
  // the iframe isn't unmounted mid-stream.
  const startedForRef = useRef<string | null>(null);
  const isReady =
    (Boolean(progressKey) && startedForRef.current === progressKey) ||
    (Boolean(details && tmdbId && isProgressLoaded) &&
      (!isEpisodic || Boolean(episodes && episodes.length > 0)));
  if (isReady) startedForRef.current = progressKey;

  const buildEmbedUrl = useCallback(
    (startAt: number, autoNext = true) => {
      if (!tmdbId) return "";
      return isEpisodic
        ? buildVidfastTvUrl(tmdbId, loaded.season, loaded.episode, startAt, autoNext)
        : buildVidfastMovieUrl(tmdbId, startAt);
    },
    [tmdbId, isEpisodic, loaded.season, loaded.episode]
  );

  return {
    details,
    title,
    isEpisodic,
    isReady,
    current,
    loaded,
    currentEpisodeInfo,
    episodes: episodes || [],
    seasonNumbers,
    nextEpisode,
    showUpNext,
    dismissUpNext,
    resumeSeconds,
    buildEmbedUrl,
    selectEpisode,
  };
}
