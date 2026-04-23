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

export default function TVDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [tvShow, setTVShow] = useState<TVDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodesCount, setEpisodesCount] = useState(0);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadSources, setDownloadSources] = useState<SourceItem[]>([]);
  const [downloadSubtitles, setDownloadSubtitles] = useState<SubtitleItem[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

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
    if (!id) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setIsProgressLoaded(true);
        return;
      }

      const parsed = JSON.parse(stored) as {
        seasonNumber?: number;
        episodeNumber?: number;
        timestamp?: number;
      };
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
    let existingTimestamp = 0;
    let existingDuration = 0;
    let existingProgress = 0;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          seasonNumber?: number;
          episodeNumber?: number;
          timestamp?: number;
          duration?: number;
          progress?: number;
        };

        if (Number(parsed.seasonNumber) === seasonNumber && Number(parsed.episodeNumber) === episodeNumber) {
          existingTimestamp = Math.max(0, Math.floor(Number(parsed.timestamp || 0)));
          existingDuration = Math.max(0, Math.floor(Number(parsed.duration || 0)));
          existingProgress = Math.max(0, Math.min(100, Number(parsed.progress || 0)));
        }
      }
    } catch {
      // Ignore invalid localStorage data.
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        title: tvShow?.name || "Untitled",
        posterPath: tvShow?.poster_path || "",
        mediaType: "tv",
        seasonNumber,
        episodeNumber,
        timestamp: existingTimestamp,
        duration: existingDuration,
        progress: existingProgress,
        updatedAt: new Date().toISOString(),
      })
    );
  }, [id, seasonNumber, episodeNumber, isProgressLoaded, tvShow?.name, tvShow?.poster_path]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;

    const handleProgressMessage = (event: MessageEvent) => {
      if (!event.origin.includes("videasy")) return;

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

      const payloadType = String(payload?.type || payload?.mediaType || "");
      if (!payload || payloadType !== "tv") return;
      if (String(payload.id) !== storageId) return;

      const payloadSeason = Number(payload.season);
      const payloadEpisode = Number(payload.episode);
      if (payloadSeason !== seasonNumber || payloadEpisode !== episodeNumber) return;

      const timestamp = Math.max(0, Math.floor(Number(payload.timestamp || 0)));
      const duration = Math.max(0, Math.floor(Number(payload.duration || 0)));
      const progress = Math.max(0, Math.min(100, Number(payload.progress || 0)));

      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          title: tvShow?.name || "Untitled",
          posterPath: tvShow?.poster_path || "",
          mediaType: "tv",
          seasonNumber,
          episodeNumber,
          timestamp,
          duration,
          progress,
          updatedAt: new Date().toISOString(),
        })
      );
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, isProgressLoaded, seasonNumber, episodeNumber, tvShow?.name, tvShow?.poster_path]);

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

  const handleSeasonChange = (value: number) => {
    setSeasonNumber(value);
  };

  const title = tvShow?.name || "Untitled";
  const releaseDate = tvShow?.first_air_date || "Unknown";
  const posterUrl = tvShow?.poster_path
    ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}`
    : "/no-image.svg";
  const backdropUrl = tvShow?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${tvShow.backdrop_path}`
    : undefined;

  const metadata = useMemo(
    () => [
      { label: "First Air", value: releaseDate },
      { label: "Rating", value: tvShow?.vote_average ? tvShow.vote_average.toFixed(1) : "N/A" },
      { label: "Episodes", value: tvShow?.number_of_episodes ? String(tvShow.number_of_episodes) : "N/A" },
      { label: "Seasons", value: tvShow?.number_of_seasons ? String(tvShow.number_of_seasons) : "N/A" },
    ],
    [releaseDate, tvShow?.number_of_episodes, tvShow?.number_of_seasons, tvShow?.vote_average]
  );

  const tags = useMemo(
    () => (tvShow?.genres || []).slice(0, 6).map((genre) => genre.name),
    [tvShow?.genres]
  );

  if (!tvShow) return <div className="loading">Loading...</div>;
  const tvId = Array.isArray(id) ? id[0] : id;
  const tvQuery = new URLSearchParams({
    color: "e50914",
    nextEpisode: "true",
    episodeSelector: "true",
    autoplayNextEpisode: "true",
    overlay: "true",
  });
  if (resumeSeconds > 0) {
    tvQuery.set("progress", String(resumeSeconds));
  }

  const handleDownload = async () => {
    const tmdbId = Number(Array.isArray(id) ? id[0] : id);
    if (!tmdbId) return;

    try {
      setIsDownloading(true);
      setDownloadError("");

      const decoded = await fetchVideasyDownloadData({
        tmdbId,
        mediaType: "tv",
        title,
        year: (tvShow.first_air_date || "").slice(0, 4),
        seasonId: seasonNumber,
        episodeId: episodeNumber,
        totalSeasons: Number(tvShow.number_of_seasons || 0),
      });

      setDownloadSources(decoded.sources || []);
      setDownloadSubtitles(decoded.subtitles || []);
      setDownloadTitle(
        `${title} | S${seasonNumber}E${episodeNumber}${
          tvShow.first_air_date ? ` - [${String(tvShow.first_air_date).slice(0, 4)}]` : ""
        }`
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
        mediaLabel="Series"
        title={title}
        summary={tvShow.overview || "No overview is available for this series yet."}
        embedUrl={`https://player.videasy.net/tv/${tvId}/${seasonNumber}/${episodeNumber}?${tvQuery.toString()}`}
        posterUrl={posterUrl}
        backdropUrl={backdropUrl}
        metadata={metadata}
        tags={tags}
        controls={
          <>
            <label className="detail-select-field">
              <span>Season</span>
              <select value={seasonNumber} onChange={(e) => handleSeasonChange(Number(e.target.value))}>
                {Array.from({ length: tvShow.number_of_seasons || 0 }, (_, i) => i + 1).map((season) => (
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
