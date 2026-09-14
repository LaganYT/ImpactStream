import axios from "axios";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import MediaDetailShell from "../../components/MediaDetailShell";
import {
  buildVidfastMovieUrl,
  buildVidfastTvUrl,
  getVidfastMediaEntry,
  parseVidfastMessageData,
  toContinueProgress,
  VIDFAST_ORIGIN,
} from "../../utils/vidfast";

type AnimeType = "movie" | "tv";

type AnimeDetails = {
  title?: string;
  name?: string;
  poster_path?: string;
};

type StoredAnimeProgress = {
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

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

function shouldTrackContinueWatching(progress: StoredAnimeProgress) {
  const seasonNumber = Number(progress.seasonNumber || 1);
  const episodeNumber = Number(progress.episodeNumber || 1);
  const timestamp = Math.max(0, Number(progress.timestamp || 0));
  const percentComplete = Math.max(0, Number(progress.progress || 0));

  return (
    timestamp > 0 ||
    percentComplete > 0 ||
    seasonNumber !== 1 ||
    episodeNumber !== 1
  );
}

export default function AnimeDetailsPage() {
  const router = useRouter();
  const { id, type } = router.query;
  const animeType: AnimeType = type === "movie" ? "movie" : "tv";

  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeCount, setEpisodeCount] = useState(0);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchAnime = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/${animeType}/${id}`, {
        params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
      });
      setAnime(data);
    };

    fetchAnime();
  }, [id, animeType]);

  useEffect(() => {
    if (!id || !anime) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:${animeType}:${mediaId}`;
    const indexKey = "continueWatching:index";

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      const storedData: StoredAnimeProgress = storedEntry ? JSON.parse(storedEntry) : {};
      const nextData: StoredAnimeProgress = {
        ...storedData,
        title: anime.title || anime.name || storedData.title,
        posterPath: anime.poster_path || storedData.posterPath,
        mediaType: `anime:${animeType}`,
        tmdbId: mediaId,
        updatedAt: storedData.updatedAt || new Date().toISOString(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const storedIndex = window.localStorage.getItem(indexKey);
      const indexEntries: string[] = storedIndex ? JSON.parse(storedIndex) : [];
      const indexEntry = `anime:${animeType}:${mediaId}`;
      const updatedIndex = indexEntries.filter((entry) => entry !== indexEntry);
      if (animeType === "movie" || shouldTrackContinueWatching(nextData)) {
        updatedIndex.unshift(indexEntry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(updatedIndex.slice(0, 50)));
    } catch {}
  }, [id, anime, animeType]);

  useEffect(() => {
    if (!id || animeType !== "tv") {
      setIsProgressLoaded(true);
      return;
    }

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:tv:${mediaId}`;

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      const storedData: StoredAnimeProgress = storedEntry ? JSON.parse(storedEntry) : {};
      const savedSeason = Number(storedData.seasonNumber);
      const savedEpisode = Number(storedData.episodeNumber);
      const savedTimestamp = Math.floor(Number(storedData.timestamp || 0));

      if (Number.isFinite(savedSeason) && savedSeason > 0) setSeasonNumber(savedSeason);
      if (Number.isFinite(savedEpisode) && savedEpisode > 0) setEpisodeNumber(savedEpisode);
      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      setResumeSeconds(0);
    } finally {
      const querySeason = Number(
        Array.isArray(router.query.season) ? router.query.season[0] : router.query.season
      );
      const queryEpisode = Number(
        Array.isArray(router.query.episode) ? router.query.episode[0] : router.query.episode
      );
      if (Number.isFinite(querySeason) && querySeason > 0) setSeasonNumber(querySeason);
      if (Number.isFinite(queryEpisode) && queryEpisode > 0) setEpisodeNumber(queryEpisode);
      setIsProgressLoaded(true);
    }
  }, [id, animeType, router.query.episode, router.query.season]);

  useEffect(() => {
    if (!id || animeType !== "tv" || !isProgressLoaded) return;

    const fetchSeason = async () => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`,
          { params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY } }
        );
        const nextEpisodeCount = Array.isArray(data.episodes) ? data.episodes.length : 0;
        setEpisodeCount(nextEpisodeCount);
        setEpisodeNumber((currentEpisode) => {
          if (nextEpisodeCount === 0) return 0;
          if (currentEpisode > nextEpisodeCount) return 1;
          return currentEpisode > 0 ? currentEpisode : 1;
        });
      } catch {
        setEpisodeCount(0);
        setEpisodeNumber(0);
      }
    };

    fetchSeason();
  }, [id, animeType, seasonNumber, isProgressLoaded]);

  useEffect(() => {
    if (
      !id ||
      animeType !== "tv" ||
      !isProgressLoaded ||
      seasonNumber <= 0 ||
      episodeNumber <= 0
    ) {
      return;
    }

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:tv:${mediaId}`;
    const indexKey = "continueWatching:index";
    const indexEntry = `anime:tv:${mediaId}`;

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      const storedData: StoredAnimeProgress = storedEntry ? JSON.parse(storedEntry) : {};
      const sameEpisode =
        Number(storedData.seasonNumber) === seasonNumber &&
        Number(storedData.episodeNumber) === episodeNumber;
      const nextData: StoredAnimeProgress = {
        ...storedData,
        seasonNumber,
        episodeNumber,
        timestamp: sameEpisode ? Math.max(0, Math.floor(Number(storedData.timestamp || 0))) : 0,
        progress: sameEpisode
          ? Math.max(0, Math.min(100, Number(storedData.progress || 0)))
          : 0,
        updatedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const storedIndex = window.localStorage.getItem(indexKey);
      const indexEntries: string[] = storedIndex ? JSON.parse(storedIndex) : [];
      const updatedIndex = indexEntries.filter((entry) => entry !== indexEntry);
      if (shouldTrackContinueWatching(nextData)) updatedIndex.unshift(indexEntry);
      window.localStorage.setItem(indexKey, JSON.stringify(updatedIndex.slice(0, 50)));
    } catch {}
  }, [id, animeType, seasonNumber, episodeNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:${animeType}:${mediaId}`;

    const handleProgressMessage = (event: MessageEvent) => {
      if (event.origin !== VIDFAST_ORIGIN) return;

      const message = parseVidfastMessageData(event.data) as {
        type?: string;
        data?: unknown;
      } | null;
      if (!message || message.type !== "MEDIA_DATA") return;

      window.localStorage.setItem("vidFastProgress", JSON.stringify(message.data));

      const mediaEntry = getVidfastMediaEntry(message.data, mediaId);
      if (!mediaEntry || mediaEntry.type !== animeType) return;

      const nextProgress = toContinueProgress(mediaEntry, seasonNumber, episodeNumber);
      const nextSeasonNumber =
        animeType === "tv" ? nextProgress.seasonNumber || seasonNumber : 1;
      const nextEpisodeNumber = nextProgress.episodeNumber || episodeNumber;

      if (animeType === "tv" && nextSeasonNumber > 0 && nextEpisodeNumber > 0) {
        if (nextSeasonNumber !== seasonNumber) setSeasonNumber(nextSeasonNumber);
        if (nextEpisodeNumber !== episodeNumber) setEpisodeNumber(nextEpisodeNumber);
      }

      const nextData: StoredAnimeProgress = {
        seasonNumber: animeType === "tv" ? nextSeasonNumber : 1,
        episodeNumber: animeType === "tv" ? nextEpisodeNumber : 1,
        timestamp: nextProgress.timestamp,
        duration: nextProgress.duration,
        progress: nextProgress.progress,
        updatedAt: new Date().toISOString(),
        title: anime?.title || anime?.name || undefined,
        posterPath: anime?.poster_path || undefined,
        mediaType: `anime:${animeType}`,
        tmdbId: mediaId,
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const indexKey = "continueWatching:index";
      const storedIndex = window.localStorage.getItem(indexKey);
      const indexEntries: string[] = storedIndex ? JSON.parse(storedIndex) : [];
      const indexEntry = `anime:${animeType}:${mediaId}`;
      const updatedIndex = indexEntries.filter((entry) => entry !== indexEntry);
      if (animeType === "movie" || shouldTrackContinueWatching(nextData)) {
        updatedIndex.unshift(indexEntry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(updatedIndex.slice(0, 50)));
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, animeType, isProgressLoaded, seasonNumber, episodeNumber, anime]);

  useEffect(() => {
    if (!id || !isProgressLoaded) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:${animeType}:${mediaId}`;

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      if (!storedEntry) {
        setResumeSeconds(0);
        return;
      }

      const storedData: StoredAnimeProgress = JSON.parse(storedEntry);
      if (
        animeType === "tv" &&
        (Number(storedData.seasonNumber) !== seasonNumber ||
          Number(storedData.episodeNumber) !== episodeNumber)
      ) {
        setResumeSeconds(0);
        return;
      }

      const savedTimestamp = Math.floor(Number(storedData.timestamp || 0));
      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      setResumeSeconds(0);
    }
  }, [id, animeType, isProgressLoaded, seasonNumber, episodeNumber]);

  const streamUrl = useMemo(() => {
    if (!id) return "";

    const mediaId = Array.isArray(id) ? id[0] : id;
    if (!mediaId) return "";

    return animeType === "movie"
      ? buildVidfastMovieUrl(mediaId, resumeSeconds)
      : buildVidfastTvUrl(mediaId, seasonNumber, episodeNumber, resumeSeconds);
  }, [id, animeType, seasonNumber, episodeNumber, resumeSeconds]);

  const isReady =
    Boolean(anime) &&
    Boolean(streamUrl) &&
    (animeType === "movie" || (episodeCount > 0 && seasonNumber > 0 && episodeNumber > 0));

  if (!isReady) return <div className="loading">Loading...</div>;

  return (
    <MediaDetailShell title={anime?.title || anime?.name || "Untitled"} embedUrl={streamUrl} />
  );
}
