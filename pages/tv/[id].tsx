import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { SourceItem, SubtitleItem } from "../../utils/videasyDownloader";
import MediaDetailShell from "../../components/MediaDetailShell";
import DownloadModal from "../../components/DownloadModal";
import { useVideasySourceResolution } from "../../hooks/useVideasySourceResolution";

type TVDetails = {
  id: string;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: number | null;
  releaseDate: string | null;
  seasonsLabel?: string;
  genres: string[];
  releaseYear: string;
  totalSeasons?: number;
  imdbId?: string | null;
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
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadSources, setDownloadSources] = useState<SourceItem[]>([]);
  const [downloadSubtitles, setDownloadSubtitles] = useState<SubtitleItem[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchTVShow = async () => {
      const { data } = await axios.get("/api/details", {
        params: { id, tmdbType: "tv", category: "tv" },
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
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        seasonNumber,
        episodeNumber,
        timestamp: 0,
        updatedAt: new Date().toISOString(),
      })
    );
  }, [id, seasonNumber, episodeNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;

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

      if (!payload || payload.type !== "tv") return;
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
  }, [id, isProgressLoaded, seasonNumber, episodeNumber]);

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

  const tmdbId = Number(Array.isArray(id) ? id[0] : id);
  const sourceResolution = useVideasySourceResolution({
    enabled: Boolean(tvShow && tmdbId && seasonNumber > 0 && episodeNumber > 0),
    request:
      tvShow && tmdbId && seasonNumber > 0 && episodeNumber > 0
        ? {
            tmdbId,
            mediaType: "tv",
            title: tvShow.title,
            year: tvShow.releaseYear,
            seasonId: seasonNumber,
            episodeId: episodeNumber,
            totalSeasons: Number(tvShow.totalSeasons || 0),
            imdbId: tvShow.imdbId || undefined,
          }
        : null,
  });

  const handleSeasonChange = (value: number) => {
    setSeasonNumber(value);
  };

  const title = tvShow?.title || "Untitled";
  const releaseDate = tvShow?.releaseDate || "Unknown";
  const posterUrl = tvShow?.posterUrl || "/no-image.svg";
  const backdropUrl = tvShow?.backdropUrl || undefined;

  const metadata = useMemo(
    () => [
      { label: "First Air", value: releaseDate },
      { label: "Rating", value: typeof tvShow?.rating === "number" ? tvShow.rating.toFixed(1) : "N/A" },
      { label: "Episodes", value: episodesCount > 0 ? String(episodesCount) : "N/A" },
      { label: "Seasons", value: tvShow?.seasonsLabel ? tvShow.seasonsLabel.split(" ")[0] : "N/A" },
    ],
    [releaseDate, tvShow?.rating, tvShow?.seasonsLabel, episodesCount]
  );

  const tags = useMemo(() => tvShow?.genres || [], [tvShow?.genres]);

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
    setDownloadTitle(
      `${title} | S${seasonNumber}E${episodeNumber}${
        tvShow.releaseYear ? ` - [${tvShow.releaseYear}]` : ""
      }`
    );
    setIsDownloadModalOpen(true);
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
        infoNote={`${sourceResolution.loadingSources ? "Resolving sources... " : ""}${
          sourceResolution.availabilityNote
        }`}
        controls={
          <>
            <label className="detail-select-field">
              <span>Season</span>
              <select value={seasonNumber} onChange={(e) => handleSeasonChange(Number(e.target.value))}>
                {Array.from({ length: tvShow.totalSeasons || 0 }, (_, i) => i + 1).map((season) => (
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

            <button onClick={handleDownload} disabled={sourceResolution.loadingSources || !sourceResolution.downloadAvailable}>
              {sourceResolution.loadingSources
                ? "Resolving..."
                : sourceResolution.downloadAvailable
                  ? "Download"
                  : "Unavailable"}
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
