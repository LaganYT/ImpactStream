import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { SourceItem, SubtitleItem } from "../../utils/videasyDownloader";
import MediaDetailShell from "../../components/MediaDetailShell";
import DownloadModal from "../../components/DownloadModal";
import { useVideasySourceResolution } from "../../hooks/useVideasySourceResolution";

type MovieDetails = {
  id: string;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  releaseYear: string;
  rating: number | null;
  runtimeLabel: string;
  genres: string[];
  availabilityNote: string;
  imdbId?: string | null;
};

export default function MovieDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadSources, setDownloadSources] = useState<SourceItem[]>([]);
  const [downloadSubtitles, setDownloadSubtitles] = useState<SubtitleItem[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

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
        })
      );
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      const { data } = await axios.get("/api/details", {
        params: {
          id,
          tmdbType: "movie",
          category: "movie",
        },
      });
      setMovie(data);
    };

    fetchDetails();
  }, [id]);

  const tmdbId = Number(Array.isArray(id) ? id[0] : id);
  const sourceResolution = useVideasySourceResolution({
    enabled: Boolean(movie && tmdbId),
    request:
      movie && tmdbId
        ? {
            tmdbId,
            mediaType: "movie",
            title: movie.title,
            year: movie.releaseYear,
            imdbId: movie.imdbId || undefined,
          }
        : null,
  });

  const title = movie?.title || "Untitled";
  const releaseDate = movie?.releaseDate || "Unknown";
  const posterUrl = movie?.posterUrl || "/no-image.svg";
  const backdropUrl = movie?.backdropUrl || undefined;

  const metadata = useMemo(
    () => [
      { label: "Release", value: releaseDate },
      { label: "Rating", value: typeof movie?.rating === "number" ? movie.rating.toFixed(1) : "N/A" },
      { label: "Runtime", value: movie?.runtimeLabel || "Unknown" },
    ],
    [movie?.rating, movie?.runtimeLabel, releaseDate]
  );

  const tags = useMemo(() => movie?.genres || [], [movie?.genres]);

  if (!movie) return <div className="loading">Loading...</div>;

  const movieId = Array.isArray(id) ? id[0] : id;
  const movieQuery = new URLSearchParams({
    color: "e50914",
    nextEpisode: "true",
    episodeSelector: "true",
    overlay: "true",
  });
  if (resumeSeconds > 0) {
    movieQuery.set("progress", String(resumeSeconds));
  }

  const handleDownload = async () => {
    setDownloadError("");

    if (!sourceResolution.resolvedSources.length) {
      setDownloadError(sourceResolution.availabilityNote || "No download sources are available yet.");
      setDownloadSources([]);
      setDownloadSubtitles([]);
      setDownloadTitle(title);
      setIsDownloadModalOpen(true);
      return;
    }

    setDownloadSources(sourceResolution.resolvedSources);
    setDownloadSubtitles(sourceResolution.resolvedSubtitles);
    setDownloadTitle(`${title}${movie.releaseYear ? ` - [${movie.releaseYear}]` : ""}`);
    setIsDownloadModalOpen(true);
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
        metadata={metadata}
        tags={tags}
        infoNote={`${sourceResolution.loadingSources ? "Resolving sources... " : ""}${
          sourceResolution.availabilityNote || movie.availabilityNote
        }`}
        actions={
          <button
            onClick={handleDownload}
            disabled={sourceResolution.loadingSources || !sourceResolution.downloadAvailable}
          >
            {sourceResolution.loadingSources
              ? "Resolving..."
              : sourceResolution.downloadAvailable
                ? "Download"
                : "Unavailable"}
          </button>
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
