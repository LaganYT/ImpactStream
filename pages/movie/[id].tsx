import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import axios from "axios";
import { useEffect, useState } from "react";
import MediaDetailShell from "../../components/MediaDetailShell";
import {
  buildVidnestMovieUrl,
  getVidnestMediaEntry,
  logVidnestPlayerEvent,
  parseVidnestMessageData,
  toContinueProgress,
  VIDNEST_ORIGIN,
} from "../../utils/vidnest";

type MovieDetails = {
  title?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  runtime?: number;
  genres?: { id: number; name: string }[];
  imdb_id?: string;
};

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function MovieDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [resumeSeconds, setResumeSeconds] = useState(0);

  useEffect(() => {
    if (!id) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:movie:${storageId}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored) as { timestamp?: number };
      const savedTimestamp = Math.floor(Number(parsed?.timestamp || 0));
      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      setResumeSeconds(0);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:movie:${storageId}`;

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
      if (!mediaEntry || mediaEntry.type !== "movie") return;

      const { timestamp, duration, progress } = toContinueProgress(mediaEntry);

      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          timestamp,
          duration,
          progress,
          updatedAt: new Date().toISOString(),
          title: movie?.title || undefined,
          posterPath: movie?.poster_path || undefined,
          mediaType: "movie",
          tmdbId: storageId,
        })
      );
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, movie]);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
        params: {
          api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
        },
      });
      setMovie(data);
    };

    fetchDetails();
  }, [id]);

  useEffect(() => {
    if (!id || !movie) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:movie:${storageId}`;

    try {
      const existing = window.localStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : {};
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...parsed,
          title: movie.title || parsed.title,
          posterPath: movie.poster_path || parsed.posterPath,
          mediaType: "movie",
          tmdbId: storageId,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        })
      );

      const indexKey = "continueWatching:index";
      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const entry = `movie:${storageId}`;
      const filtered = index.filter((e) => e !== entry);
      filtered.unshift(entry);
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    } catch {
      // Ignore storage errors.
    }
  }, [id, movie]);

  if (!movie) return <div className="loading">Loading...</div>;

  const movieId = Array.isArray(id) ? id[0] : id;
  if (!movieId) return <div className="loading">Loading...</div>;

  return (
    <MediaDetailShell
      title={movie.title || "Untitled"}
      embedUrl={buildVidnestMovieUrl(movieId, resumeSeconds)}
    />
  );
}
