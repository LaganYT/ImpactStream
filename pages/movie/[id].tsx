import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  fetchVideasyDownloadData,
  SourceItem,
  SubtitleItem,
} from "../../utils/videasyDownloader";
import MediaDetailShell from "../../components/MediaDetailShell";
import DownloadModal from "../../components/DownloadModal";

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

export default function MovieDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadSources, setDownloadSources] = useState<SourceItem[]>([]);
  const [downloadSubtitles, setDownloadSubtitles] = useState<SubtitleItem[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

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

  const title = movie?.title || "Untitled";
  const releaseDate = movie?.release_date || "Unknown";
  const posterUrl = movie?.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "/no-image.svg";
  const backdropUrl = movie?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : undefined;

  const metadata = useMemo(
    () => [
      { label: "Release", value: releaseDate },
      { label: "Rating", value: movie?.vote_average ? movie.vote_average.toFixed(1) : "N/A" },
      { label: "Runtime", value: movie?.runtime ? `${movie.runtime} min` : "Unknown" },
    ],
    [movie?.runtime, movie?.vote_average, releaseDate]
  );

  const tags = useMemo(
    () => (movie?.genres || []).slice(0, 6).map((genre) => genre.name),
    [movie?.genres]
  );

  if (!movie) return <div className="loading">Loading...</div>;

  const handleDownload = async () => {
    const tmdbId = Number(Array.isArray(id) ? id[0] : id);
    if (!tmdbId) return;

    try {
      setIsDownloading(true);
      setDownloadError("");

      const year = (movie.release_date || "").slice(0, 4);
      const decoded = await fetchVideasyDownloadData({
        tmdbId,
        mediaType: "movie",
        title,
        year,
        imdbId: movie.imdb_id || "",
      });

      setDownloadSources(decoded.sources || []);
      setDownloadSubtitles(decoded.subtitles || []);
      setDownloadTitle(`${title}${year ? ` - [${year}]` : ""}`);
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
        embedUrl={`https://player.videasy.net/movie/${id}?color=e50914&nextEpisode=true&episodeSelector=true`}
        posterUrl={posterUrl}
        backdropUrl={backdropUrl}
        metadata={metadata}
        tags={tags}
        actions={
          <button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Decoding..." : "Download"}
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
