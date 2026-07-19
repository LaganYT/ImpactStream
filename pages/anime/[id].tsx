import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import MediaDetailShell from "../../components/MediaDetailShell";
import {
  buildVidnestAnimeUrl,
  getVidnestMediaEntry,
  logVidnestPlayerEvent,
  parseVidnestMessageData,
  toContinueProgress,
  VIDNEST_ORIGIN,
} from "../../utils/vidnest";

type AnimeType = "movie" | "tv";

type AnimeDetails = {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: { id: number; name: string }[];
};

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

type AniListSearchResult = {
  id: number;
};

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

export default function AnimeDetailsPage() {
  const router = useRouter();
  const { id, type } = router.query;

  const animeType: AnimeType = type === "movie" ? "movie" : "tv";

  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodesCount, setEpisodesCount] = useState(0);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [anilistId, setAnilistId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/${animeType}/${id}`, {
        params: {
          api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
        },
      });
      setAnime(data);
    };

    fetchDetails();
  }, [id, animeType]);

  useEffect(() => {
    if (!anime) return;

    const title = anime.title || anime.name;
    if (!title) return;

    const fetchAniListId = async () => {
      const year = Number(
        (anime.release_date || anime.first_air_date || "").slice(0, 4)
      );
      const query = `
        query ($search: String, $format: MediaFormat, $year: Int) {
          Page(page: 1, perPage: 1) {
            media(search: $search, type: ANIME, format: $format, seasonYear: $year) {
              id
            }
          }
        }
      `;

      try {
        const format = animeType === "movie" ? "MOVIE" : "TV";
        const { data } = await axios.post("https://graphql.anilist.co", {
          query,
          variables: {
            search: title,
            format,
            year: Number.isFinite(year) && year > 0 ? year : undefined,
          },
        });
        const result = data?.data?.Page?.media?.[0] as AniListSearchResult | undefined;
        setAnilistId(result?.id ? String(result.id) : null);
      } catch {
        setAnilistId(null);
      }
    };

    fetchAniListId();
  }, [anime, animeType]);

  useEffect(() => {
    if (!id || !anime) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:${animeType}:${storageId}`;
    const indexKey = "continueWatching:index";

    try {
      const existing = window.localStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : {};
      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const entry = `anime:${animeType}:${storageId}`;
      const nextData = {
        ...parsed,
        title: anime.title || anime.name || parsed.title,
        posterPath: anime.poster_path || parsed.posterPath,
        mediaType: `anime:${animeType}`,
        tmdbId: storageId,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const filtered = index.filter((e) => e !== entry);
      if (animeType === "movie" || shouldTrackContinueWatching(nextData)) {
        filtered.unshift(entry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    } catch {
      // Ignore storage errors.
    }
  }, [id, anime, animeType]);

  useEffect(() => {
    if (!id || animeType !== "tv") {
      setIsProgressLoaded(true);
      return;
    }

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:tv:${storageId}`;

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
  }, [id, animeType]);

  useEffect(() => {
    if (!id || animeType !== "tv" || !isProgressLoaded) return;

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
  }, [id, animeType, seasonNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || animeType !== "tv" || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:tv:${storageId}`;
    const indexKey = "continueWatching:index";
    const entry = `anime:tv:${storageId}`;

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
  }, [id, animeType, seasonNumber, episodeNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:${animeType}:${storageId}`;

    const handleProgressMessage = (event: MessageEvent) => {
      if (event.origin !== VIDNEST_ORIGIN) return;

      const payload = parseVidnestMessageData(event.data) as { type?: string; data?: unknown } | null;
      if (payload?.type === "PLAYER_EVENT") {
        logVidnestPlayerEvent(payload.data);
        return;
      }
      if (!payload || payload.type !== "MEDIA_DATA" || !anilistId) return;

      window.localStorage.setItem("vidNestProgress", JSON.stringify(payload.data));

      const mediaEntry = getVidnestMediaEntry(payload.data, anilistId);
      if (!mediaEntry) return;

      const nextProgress = toContinueProgress(mediaEntry, 1, episodeNumber);
      const nextEpisode = nextProgress.episodeNumber || episodeNumber;
      if (animeType === "tv" && nextEpisode > 0) {
        if (nextEpisode !== episodeNumber) {
          setEpisodeNumber(nextEpisode);
        }
      }

      const nextData = {
        seasonNumber: 1,
        episodeNumber: animeType === "tv" ? nextEpisode : 1,
        timestamp: nextProgress.timestamp,
        duration: nextProgress.duration,
        progress: nextProgress.progress,
        updatedAt: new Date().toISOString(),
        title: anime?.title || anime?.name || undefined,
        posterPath: anime?.poster_path || undefined,
        mediaType: `anime:${animeType}`,
        tmdbId: storageId,
      };

      window.localStorage.setItem(
        storageKey,
        JSON.stringify(nextData)
      );

      const indexKey = "continueWatching:index";
      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const entry = `anime:${animeType}:${storageId}`;
      const filtered = index.filter((e) => e !== entry);
      if (animeType === "movie" || shouldTrackContinueWatching(nextData)) {
        filtered.unshift(entry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, animeType, isProgressLoaded, episodeNumber, anime, anilistId]);

  useEffect(() => {
    if (!id || !isProgressLoaded) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:${animeType}:${storageId}`;

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
      if (
        animeType === "tv" &&
        (Number(parsed.seasonNumber) !== seasonNumber || Number(parsed.episodeNumber) !== episodeNumber)
      ) {
        setResumeSeconds(0);
        return;
      }

      const savedTimestamp = Math.floor(Number(parsed.timestamp || 0));
      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      setResumeSeconds(0);
    }
  }, [id, animeType, isProgressLoaded, seasonNumber, episodeNumber]);

  const streamUrl = useMemo(() => {
    if (!anilistId) return "";

    if (animeType === "movie") {
      return buildVidnestAnimeUrl(anilistId, 1, resumeSeconds);
    }

    return buildVidnestAnimeUrl(anilistId, episodeNumber, resumeSeconds);
  }, [anilistId, animeType, episodeNumber, resumeSeconds]);

  const isReady =
    Boolean(anime) && Boolean(streamUrl) &&
    (animeType === "movie" || (episodesCount > 0 && seasonNumber > 0 && episodeNumber > 0));

  if (!isReady) return <div className="loading">Loading...</div>;

  return (
    <MediaDetailShell title={anime?.title || anime?.name || "Untitled"} embedUrl={streamUrl} />
  );
}
