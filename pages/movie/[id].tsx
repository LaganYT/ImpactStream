import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  fetchVideasyDownloadData,
  SourceItem,
  SubtitleItem,
} from "../../utils/videasyDownloader";
import { getDetailRoute, RoutableMediaItem } from "../../utils/mediaRouting";
import MediaDetailShell from "../../components/MediaDetailShell";
import DownloadModal from "../../components/DownloadModal";
import MediaRow, { MediaRowItem } from "../../components/MediaRow";

type RecommendationItem = RoutableMediaItem & {
  title?: string;
  name?: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
};

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
  credits?: { cast?: { name: string }[] };
  recommendations?: { results?: RecommendationItem[] };
};

function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function MovieDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadSources, setDownloadSources] = useState<SourceItem[]>([]);
  const [downloadSubtitles, setDownloadSubtitles] = useState<SubtitleItem[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.play === "1") setIsPlaying(true);
  }, [router.isReady, router.query.play]);

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
      if (event.origin !== "https://player.videasy.net") return;

      const payload =
        typeof event.data === "string"
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch {
                return null;
              }
            })()
          : event.data;

      if (!payload || payload.type !== "movie") return;
      if (String(payload.id) !== storageId) return;

      const timestamp = Math.max(0, Math.floor(Number(payload.timestamp || 0)));
      const duration = Math.max(0, Math.floor(Number(payload.duration || 0)));
      const progress = Math.max(0, Math.min(100, Number(payload.progress || 0)));

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
          append_to_response: "credits,recommendations",
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

  const title = movie?.title || "Untitled";
  const releaseDate = movie?.release_date || "Unknown";
  const year = movie?.release_date?.slice(0, 4);
  const runtimeLabel = formatRuntime(movie?.runtime);
  const posterUrl = movie?.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "/no-image.svg";
  const backdropUrl = movie?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : undefined;

  const metadata = useMemo(
    () => [
      { label: "Release date", value: releaseDate },
      { label: "Rating", value: movie?.vote_average ? movie.vote_average.toFixed(1) : "N/A" },
      { label: "Runtime", value: runtimeLabel || "Unknown" },
    ],
    [movie?.vote_average, releaseDate, runtimeLabel]
  );

  const tags = useMemo(
    () => (movie?.genres || []).slice(0, 6).map((genre) => genre.name),
    [movie?.genres]
  );

  const cast = useMemo(
    () => (movie?.credits?.cast || []).slice(0, 5).map((person) => person.name),
    [movie?.credits]
  );

  const recommendations = useMemo(
    () => (movie?.recommendations?.results || []).filter((item) => item.poster_path),
    [movie?.recommendations]
  );

  const recommendationRowItems: MediaRowItem[] = recommendations.slice(0, 18).map((item) => ({
    id: item.id,
    title: item.title || item.name || "Untitled",
    posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
    year: (item.release_date || "").slice(0, 4) || undefined,
    rating: item.vote_average,
  }));

  const handleRecommendationClick = (row: MediaRowItem) => {
    const match = recommendations.find((item) => item.id === row.id);
    if (match) router.push(getDetailRoute(match));
  };

  if (!movie) return <div className="loading">Loading...</div>;

  const movieId = Array.isArray(id) ? id[0] : id;
  const movieQuery = new URLSearchParams({
    color: "e50914",
    autoplay: "true",
    nextEpisode: "true",
    episodeSelector: "true",
    overlay: "true",
  });
  if (resumeSeconds > 0) {
    movieQuery.set("progress", String(resumeSeconds));
  }

  const handleDownload = async () => {
    const tmdbId = Number(Array.isArray(id) ? id[0] : id);
    if (!tmdbId) return;

    try {
      setIsDownloading(true);
      setDownloadError("");

      const releaseYear = (movie.release_date || "").slice(0, 4);
      const decoded = await fetchVideasyDownloadData({
        tmdbId,
        mediaType: "movie",
        title,
        year: releaseYear,
        imdbId: movie.imdb_id || "",
      });

      setDownloadSources(decoded.sources || []);
      setDownloadSubtitles(decoded.subtitles || []);
      setDownloadTitle(`${title}${releaseYear ? ` - [${releaseYear}]` : ""}`);
      setIsDownloadModalOpen(true);
    } catch (error: any) {
      setDownloadError(error?.message || "Unable to load download sources.");
      setIsDownloadModalOpen(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <MediaDetailShell
        mediaLabel="Movie"
        title={title}
        summary={movie.overview || "No overview is available for this title yet."}
        embedUrl={`https://player.videasy.net/movie/${movieId}?${movieQuery.toString()}`}
        posterUrl={posterUrl}
        backdropUrl={backdropUrl}
        rating={movie.vote_average}
        metaItems={[year, runtimeLabel].filter(Boolean) as string[]}
        metadata={metadata}
        tags={tags}
        cast={cast}
        isPlaying={isPlaying}
        onPlay={() => setIsPlaying(true)}
        playLabel={resumeSeconds > 0 ? "Resume" : "Play"}
        actions={
          <button className="btn-more-info" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Decoding..." : "Download"}
          </button>
        }
        recommendations={
          recommendationRowItems.length ? (
            <MediaRow
              title="More Like This"
              items={recommendationRowItems}
              onItemClick={handleRecommendationClick}
            />
          ) : null
        }
      />

      <DownloadModal
        isOpen={isDownloadModalOpen}
        title={downloadTitle}
        error={downloadError}
        sources={downloadSources}
        subtitles={downloadSubtitles}
        fallbackName={title}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </>
  );
}
