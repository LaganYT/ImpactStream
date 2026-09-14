import axios from "axios";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import MediaDetailShell from "../../components/MediaDetailShell";
import {
  buildVidfastTvUrl,
  getVidfastMediaEntry,
  parseVidfastMessageData,
  toContinueProgress,
  VIDFAST_ORIGIN,
} from "../../utils/vidfast";

type TvDetails = {
  name?: string;
  poster_path?: string;
};

type StoredTvProgress = {
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

function shouldTrackContinueWatching(progress: StoredTvProgress) {
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

export default function TvDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [show, setShow] = useState<TvDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeCount, setEpisodeCount] = useState(0);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchShow = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${id}`, {
        params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
      });
      setShow(data);
    };

    fetchShow();
  }, [id]);

  useEffect(() => {
    if (!id || !show) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${mediaId}`;
    const indexKey = "continueWatching:index";

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      const storedData: StoredTvProgress = storedEntry ? JSON.parse(storedEntry) : {};
      const nextData: StoredTvProgress = {
        ...storedData,
        title: show.name || storedData.title,
        posterPath: show.poster_path || storedData.posterPath,
        mediaType: "tv",
        tmdbId: mediaId,
        updatedAt: storedData.updatedAt || new Date().toISOString(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const storedIndex = window.localStorage.getItem(indexKey);
      const indexEntries: string[] = storedIndex ? JSON.parse(storedIndex) : [];
      const indexEntry = `tv:${mediaId}`;
      const updatedIndex = indexEntries.filter((entry) => entry !== indexEntry);
      if (shouldTrackContinueWatching(nextData)) updatedIndex.unshift(indexEntry);
      window.localStorage.setItem(indexKey, JSON.stringify(updatedIndex.slice(0, 50)));
    } catch {}
  }, [id, show]);

  useEffect(() => {
    if (!id) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${mediaId}`;

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      const storedData: StoredTvProgress = storedEntry ? JSON.parse(storedEntry) : {};
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
  }, [id, router.query.episode, router.query.season]);

  useEffect(() => {
    if (!show || !id || !isProgressLoaded) return;

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
  }, [show, id, seasonNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${mediaId}`;
    const indexKey = "continueWatching:index";
    const indexEntry = `tv:${mediaId}`;

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      const storedData: StoredTvProgress = storedEntry ? JSON.parse(storedEntry) : {};
      const sameEpisode =
        Number(storedData.seasonNumber) === seasonNumber &&
        Number(storedData.episodeNumber) === episodeNumber;
      const nextData: StoredTvProgress = {
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
  }, [id, seasonNumber, episodeNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${mediaId}`;

    const handleProgressMessage = (event: MessageEvent) => {
      if (event.origin !== VIDFAST_ORIGIN) return;

      const message = parseVidfastMessageData(event.data) as {
        type?: string;
        data?: unknown;
      } | null;
      if (!message || message.type !== "MEDIA_DATA") return;

      window.localStorage.setItem("vidFastProgress", JSON.stringify(message.data));

      const mediaEntry = getVidfastMediaEntry(message.data, mediaId);
      if (!mediaEntry || mediaEntry.type !== "tv") return;

      const nextProgress = toContinueProgress(mediaEntry, seasonNumber, episodeNumber);
      const nextSeasonNumber = nextProgress.seasonNumber || seasonNumber;
      const nextEpisodeNumber = nextProgress.episodeNumber || episodeNumber;

      if (nextSeasonNumber > 0 && nextEpisodeNumber > 0) {
        if (nextSeasonNumber !== seasonNumber) setSeasonNumber(nextSeasonNumber);
        if (nextEpisodeNumber !== episodeNumber) setEpisodeNumber(nextEpisodeNumber);
      }

      const nextData: StoredTvProgress = {
        seasonNumber: nextSeasonNumber,
        episodeNumber: nextEpisodeNumber,
        timestamp: nextProgress.timestamp,
        duration: nextProgress.duration,
        progress: nextProgress.progress,
        updatedAt: new Date().toISOString(),
        title: show?.name || undefined,
        posterPath: show?.poster_path || undefined,
        mediaType: "tv",
        tmdbId: mediaId,
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const indexKey = "continueWatching:index";
      const storedIndex = window.localStorage.getItem(indexKey);
      const indexEntries: string[] = storedIndex ? JSON.parse(storedIndex) : [];
      const indexEntry = `tv:${mediaId}`;
      const updatedIndex = indexEntries.filter((entry) => entry !== indexEntry);
      if (shouldTrackContinueWatching(nextData)) updatedIndex.unshift(indexEntry);
      window.localStorage.setItem(indexKey, JSON.stringify(updatedIndex.slice(0, 50)));
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, isProgressLoaded, seasonNumber, episodeNumber, show]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${mediaId}`;

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      if (!storedEntry) {
        setResumeSeconds(0);
        return;
      }

      const storedData: StoredTvProgress = JSON.parse(storedEntry);
      if (
        Number(storedData.seasonNumber) !== seasonNumber ||
        Number(storedData.episodeNumber) !== episodeNumber
      ) {
        setResumeSeconds(0);
        return;
      }

      const savedTimestamp = Math.floor(Number(storedData.timestamp || 0));
      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      setResumeSeconds(0);
    }
  }, [id, isProgressLoaded, seasonNumber, episodeNumber]);

  if (!show || episodeCount === 0 || seasonNumber <= 0 || episodeNumber <= 0) {
    return <div className="loading">Loading...</div>;
  }

  const tvId = Array.isArray(id) ? id[0] : id;
  if (!tvId) return <div className="loading">Loading...</div>;

  return (
    <MediaDetailShell
      title={show.name || "Untitled"}
      embedUrl={buildVidfastTvUrl(tvId, seasonNumber, episodeNumber, resumeSeconds)}
    />
  );
}
