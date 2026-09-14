import axios from "axios";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import MediaDetailShell from "../../components/MediaDetailShell";
import {
  buildVidfastMovieUrl,
  getVidfastMediaEntry,
  parseVidfastMessageData,
  toContinueProgress,
  VIDFAST_ORIGIN,
} from "../../utils/vidfast";

type MovieDetails = {
  title?: string;
  poster_path?: string;
};

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function MovieDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [resumeSeconds, setResumeSeconds] = useState(0);

  useEffect(() => {
    if (!id) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:movie:${mediaId}`;

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      if (!storedEntry) return;

      const storedData = JSON.parse(storedEntry) as { timestamp?: number };
      const savedTimestamp = Math.floor(Number(storedData.timestamp || 0));
      setResumeSeconds(savedTimestamp > 0 ? savedTimestamp : 0);
    } catch {
      setResumeSeconds(0);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:movie:${mediaId}`;

    const handleProgressMessage = (event: MessageEvent) => {
      if (event.origin !== VIDFAST_ORIGIN) return;

      const message = parseVidfastMessageData(event.data) as {
        type?: string;
        data?: unknown;
      } | null;
      if (!message || message.type !== "MEDIA_DATA") return;

      window.localStorage.setItem("vidFastProgress", JSON.stringify(message.data));

      const mediaEntry = getVidfastMediaEntry(message.data, mediaId);
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
          tmdbId: mediaId,
        })
      );
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, movie]);

  useEffect(() => {
    if (!id) return;

    const fetchMovie = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
        params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
      });
      setMovie(data);
    };

    fetchMovie();
  }, [id]);

  useEffect(() => {
    if (!id || !movie) return;

    const mediaId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:movie:${mediaId}`;
    const indexKey = "continueWatching:index";

    try {
      const storedEntry = window.localStorage.getItem(storageKey);
      const storedData = storedEntry ? JSON.parse(storedEntry) : {};
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...storedData,
          title: movie.title || storedData.title,
          posterPath: movie.poster_path || storedData.posterPath,
          mediaType: "movie",
          tmdbId: mediaId,
          updatedAt: storedData.updatedAt || new Date().toISOString(),
        })
      );

      const storedIndex = window.localStorage.getItem(indexKey);
      const indexEntries: string[] = storedIndex ? JSON.parse(storedIndex) : [];
      const indexEntry = `movie:${mediaId}`;
      const updatedIndex = indexEntries.filter((entry) => entry !== indexEntry);
      updatedIndex.unshift(indexEntry);
      window.localStorage.setItem(indexKey, JSON.stringify(updatedIndex.slice(0, 50)));
    } catch {}
  }, [id, movie]);

  if (!movie) return <div className="loading">Loading...</div>;

  const movieId = Array.isArray(id) ? id[0] : id;
  if (!movieId) return <div className="loading">Loading...</div>;

  return (
    <MediaDetailShell
      title={movie.title || "Untitled"}
      embedUrl={buildVidfastMovieUrl(movieId, resumeSeconds)}
    />
  );
}
