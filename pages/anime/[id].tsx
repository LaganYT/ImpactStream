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
  imdb_id?: string;
  genres?: { id: number; name: string }[];
  external_ids?: {
    imdb_id?: string;
  };
};

export default function AnimeDetailsPage() {
  const router = useRouter();
  const { id, type } = router.query;

  const animeType: AnimeType = type === "movie" ? "movie" : "tv";

  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodesCount, setEpisodesCount] = useState(0);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadSources, setDownloadSources] = useState<SourceItem[]>([]);
  const [downloadSubtitles, setDownloadSubtitles] = useState<SubtitleItem[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/${animeType}/${id}`, {
        params: {
          api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
          append_to_response: "external_ids",
        },
      });
      setAnime(data);
    };

    fetchDetails();
  }, [id, animeType]);

  useEffect(() => {
    if (!id || animeType !== "tv") {
      setIsProgressLoaded(true);
      return;
    }

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:anime:tv:${storageId}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setIsProgressLoaded(true);
        return;
      }

      const parsed = JSON.parse(stored) as { seasonNumber?: number; episodeNumber?: number };
      const savedSeason = Number(parsed?.seasonNumber);
      const savedEpisode = Number(parsed?.episodeNumber);

      if (Number.isFinite(savedSeason) && savedSeason > 0) {
        setSeasonNumber(savedSeason);
      }

      if (Number.isFinite(savedEpisode) && savedEpisode > 0) {
        setEpisodeNumber(savedEpisode);
      }
    } catch {
      // Ignore invalid localStorage data.
    } finally {
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
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        seasonNumber,
        episodeNumber,
        updatedAt: new Date().toISOString(),
      })
    );
  }, [id, animeType, seasonNumber, episodeNumber, isProgressLoaded]);

  const handleSeasonChange = (value: number) => {
    setSeasonNumber(value);
  };

  const title = anime?.title || anime?.name || "Untitled";
  const releaseDate = anime?.release_date || anime?.first_air_date || "Unknown";
  const runtime = anime?.runtime || anime?.episode_run_time?.[0];
  const posterUrl = anime?.poster_path
    ? `https://image.tmdb.org/t/p/w500${anime.poster_path}`
    : "/no-image.svg";
  const backdropUrl = anime?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${anime.backdrop_path}`
    : undefined;

  const streamUrl = useMemo(() => {
    if (!id) return "";
    if (animeType === "movie") {
      return `https://player.videasy.net/movie/${id}?color=e50914&nextEpisode=true&episodeSelector=true`;
    }

    return `https://player.videasy.net/tv/${id}/${seasonNumber}/${episodeNumber}?color=e50914&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true`;
  }, [id, animeType, seasonNumber, episodeNumber]);

  const metadata = useMemo(() => {
    const base = [
      { label: "Release", value: releaseDate },
      { label: "Rating", value: anime?.vote_average ? anime.vote_average.toFixed(1) : "N/A" },
    ];

    if (animeType === "movie") {
      return [...base, { label: "Runtime", value: runtime ? `${runtime} min` : "Unknown" }];
    }

    return [
      ...base,
      { label: "Episodes", value: anime?.number_of_episodes ? String(anime.number_of_episodes) : "N/A" },
      { label: "Seasons", value: anime?.number_of_seasons ? String(anime.number_of_seasons) : "N/A" },
    ];
  }, [
    anime?.number_of_episodes,
    anime?.number_of_seasons,
    anime?.vote_average,
    animeType,
    releaseDate,
    runtime,
  ]);

  const tags = useMemo(
    () => ["Anime", ...(anime?.genres || []).slice(0, 5).map((genre) => genre.name)],
    [anime?.genres]
  );

  if (!anime) return <div className="loading">Loading...</div>;

  const handleDownload = async () => {
    const tmdbId = Number(Array.isArray(id) ? id[0] : id);
    if (!tmdbId) return;

    try {
      setIsDownloading(true);
      setDownloadError("");

      const decoded = await fetchVideasyDownloadData({
        tmdbId,
        mediaType: animeType,
        title,
        year: String(releaseDate || "").slice(0, 4),
        seasonId: animeType === "tv" ? seasonNumber : 1,
        episodeId: animeType === "tv" ? episodeNumber : 1,
        totalSeasons: Number(anime.number_of_seasons || 0),
        imdbId: anime.external_ids?.imdb_id || anime.imdb_id || "",
      });

      setDownloadSources(decoded.sources || []);
      setDownloadSubtitles(decoded.subtitles || []);
      setDownloadTitle(
        animeType === "tv"
          ? `${title} | S${seasonNumber}E${episodeNumber}${
              releaseDate ? ` - [${String(releaseDate).slice(0, 4)}]` : ""
            }`
          : `${title}${releaseDate ? ` - [${String(releaseDate).slice(0, 4)}]` : ""}`
      );
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
        mediaLabel={animeType === "movie" ? "Anime Film" : "Anime Series"}
        title={title}
        summary={anime.overview || "No overview is available for this anime yet."}
        embedUrl={streamUrl}
        posterUrl={posterUrl}
        backdropUrl={backdropUrl}
        metadata={metadata}
        tags={tags}
        controls={
          animeType === "tv" ? (
            <>
              <label className="detail-select-field">
                <span>Season</span>
                <select value={seasonNumber} onChange={(e) => handleSeasonChange(Number(e.target.value))}>
                  {Array.from({ length: anime.number_of_seasons || 0 }, (_, i) => i + 1).map((season) => (
                    <option key={season} value={season}>
                      Season {season}
                    </option>
                  ))}
                </select>
              </label>

              <label className="detail-select-field">
                <span>Episode</span>
                <select
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(Number(e.target.value))}
                  disabled={episodesCount === 0}
                >
                  {Array.from({ length: episodesCount || 0 }, (_, i) => i + 1).map((episode) => (
                    <option key={episode} value={episode}>
                      Episode {episode}
                    </option>
                  ))}
                </select>
              </label>

              <button onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? "Decoding..." : "Download"}
              </button>
            </>
          ) : (
            <button onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? "Decoding..." : "Download"}
            </button>
          )
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
