import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import axios from "axios";
import { useEffect, useState } from "react";
import MediaDetailShell from "../../components/MediaDetailShell";
import {
  buildVidnestTvUrl,
  getVidnestMediaEntry,
  logVidnestPlayerEvent,
  parseVidnestMessageData,
  toContinueProgress,
  VIDNEST_ORIGIN,
} from "../../utils/vidnest";

type TVDetails = {
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number; name: string }[];
};

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

function shouldTrackContinueWatching(input: {
  seasonNumber?: number;
  episodeNumber?: number;
  timestamp?: number;
  progress?: number;
}) {
  const season = Number(input.seasonNumber || 1);
  const episode = Number(input.episodeNumber || 1);
  const timestamp = Math.max(0, Number(input.timestamp || 0));
  const progress = Math.max(0, Number(input.progress || 0));

  return timestamp > 0 || progress > 0 || season !== 1 || episode !== 1;
}

export default function TVDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [tvShow, setTVShow] = useState<TVDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodesCount, setEpisodesCount] = useState(0);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchTVShow = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${id}`, {
        params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
      });
      setTVShow(data);
    };

    fetchTVShow();
  }, [id]);

  useEffect(() => {
    if (!id || !tvShow) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;
    const indexKey = "continueWatching:index";

    try {
      const existing = window.localStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : {};
      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const entry = `tv:${storageId}`;
      const nextData = {
        ...parsed,
        title: tvShow.name || parsed.title,
        posterPath: tvShow.poster_path || parsed.posterPath,
        mediaType: "tv",
        tmdbId: storageId,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const filtered = index.filter((e) => e !== entry);
      if (shouldTrackContinueWatching(nextData)) {
        filtered.unshift(entry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    } catch {
      // Ignore storage errors.
    }
  }, [id, tvShow]);

  useEffect(() => {
    if (!id) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored
        ? (JSON.parse(stored) as {
            seasonNumber?: number;
            episodeNumber?: number;
            timestamp?: number;
          })
        : {};
      const savedSeason = Number(parsed?.seasonNumber);
      const savedEpisode = Number(parsed?.episodeNumber);
      const savedTimestamp = Math.floor(Number(parsed?.timestamp || 0));

      if (Number.isFinite(savedSeason) && savedSeason > 0) {
        setSeasonNumber(savedSeason);
      }

      if (Number.isFinite(savedEpisode) && savedEpisode > 0) {
        setEpisodeNumber(savedEpisode);
      }

      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      // Ignore invalid localStorage data.
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
  }, [id]);

  useEffect(() => {
    if (!tvShow || !id || !isProgressLoaded) return;

    const fetchSeason = async () => {
      try {
        const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`, {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        });
        const count = Array.isArray(data.episodes) ? data.episodes.length : 0;
        setEpisodesCount(count);
        setEpisodeNumber((current) => {
          if (count === 0) return 0;
          if (current > count) return 1;
          return current > 0 ? current : 1;
        });
      } catch {
        setEpisodesCount(0);
        setEpisodeNumber(0);
      }
    };

    fetchSeason();
  }, [tvShow, id, seasonNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;
    const indexKey = "continueWatching:index";
    const entry = `tv:${storageId}`;

    try {
      const existing = window.localStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : {};
      const nextData = {
        ...parsed,
        seasonNumber,
        episodeNumber,
        timestamp:
          Number(parsed.seasonNumber) === seasonNumber && Number(parsed.episodeNumber) === episodeNumber
            ? Math.max(0, Math.floor(Number(parsed.timestamp || 0)))
            : 0,
        progress:
          Number(parsed.seasonNumber) === seasonNumber && Number(parsed.episodeNumber) === episodeNumber
            ? Math.max(0, Math.min(100, Number(parsed.progress || 0)))
            : 0,
        updatedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const filtered = index.filter((e) => e !== entry);
      if (shouldTrackContinueWatching(nextData)) {
        filtered.unshift(entry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    } catch {
      // Ignore storage errors.
    }
  }, [id, seasonNumber, episodeNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;

    const handleProgressMessage = (event: MessageEvent) => {
      if (event.origin !== VIDNEST_ORIGIN) return;

      const payload = parseVidnestMessageData(event.data) as { type?: string; data?: unknown } | null;
      if (payload?.type === "PLAYER_EVENT") {
        logVidnestPlayerEvent(payload.data);
        return;
      }
      if (!payload || payload.type !== "MEDIA_DATA") return;

      window.localStorage.setItem("vidNestProgress", JSON.stringify(payload.data));

      const mediaEntry = getVidnestMediaEntry(payload.data, storageId);
      if (!mediaEntry || mediaEntry.type !== "tv") return;

      const nextProgress = toContinueProgress(mediaEntry, seasonNumber, episodeNumber);
      const nextSeason = nextProgress.seasonNumber || seasonNumber;
      const nextEpisode = nextProgress.episodeNumber || episodeNumber;
      if (nextSeason > 0 && nextEpisode > 0) {
        if (nextSeason !== seasonNumber) {
          setSeasonNumber(nextSeason);
        }
        if (nextEpisode !== episodeNumber) {
          setEpisodeNumber(nextEpisode);
        }
      }

      const nextData = {
        seasonNumber: nextSeason,
        episodeNumber: nextEpisode,
        timestamp: nextProgress.timestamp,
        duration: nextProgress.duration,
        progress: nextProgress.progress,
        updatedAt: new Date().toISOString(),
        title: tvShow?.name || undefined,
        posterPath: tvShow?.poster_path || undefined,
        mediaType: "tv",
        tmdbId: storageId,
      };

      window.localStorage.setItem(
        storageKey,
        JSON.stringify(nextData)
      );

      const indexKey = "continueWatching:index";
      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const entry = `tv:${storageId}`;
      const filtered = index.filter((e) => e !== entry);
      if (shouldTrackContinueWatching(nextData)) {
        filtered.unshift(entry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, isProgressLoaded, seasonNumber, episodeNumber, tvShow]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setResumeSeconds(0);
        return;
      }

      const parsed = JSON.parse(stored) as {
        seasonNumber?: number;
        episodeNumber?: number;
        timestamp?: number;
      };
      if (Number(parsed.seasonNumber) !== seasonNumber || Number(parsed.episodeNumber) !== episodeNumber) {
        setResumeSeconds(0);
        return;
      }

      const savedTimestamp = Math.floor(Number(parsed.timestamp || 0));
      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      setResumeSeconds(0);
    }
  }, [id, isProgressLoaded, seasonNumber, episodeNumber]);

  if (!tvShow || episodesCount === 0 || seasonNumber <= 0 || episodeNumber <= 0) {
    return <div className="loading">Loading...</div>;
  }

  const tvId = Array.isArray(id) ? id[0] : id;
  if (!tvId) return <div className="loading">Loading...</div>;

  return (
    <MediaDetailShell
      title={tvShow.name || "Untitled"}
      embedUrl={buildVidnestTvUrl(tvId, seasonNumber, episodeNumber, resumeSeconds)}
    />
  );
}
