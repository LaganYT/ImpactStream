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

  const handleSeasonChange = (value: number) => {
    setSeasonNumber(value);
  };

  const mediaId = id ? (Array.isArray(id) ? id[0] : id) : "";

  const streamUrl = useMemo(() => {
    if (!mediaId) return "";

    if (animeType === "movie") {
      const query = new URLSearchParams({
        color: "e50914",
        autoplay: "true",
        nextEpisode: "true",
        overlay: "true",
      });
      if (resumeSeconds > 0) {
        query.set("progress", String(resumeSeconds));
      }
      return `https://player.videasy.net/movie/${mediaId}?${query.toString()}`;
    }

    const query = new URLSearchParams({
      color: "e50914",
      autoplay: "true",
      nextEpisode: "true",
      episodeSelector: "true",
      autoplayNextEpisode: "true",
      overlay: "true",
    });
    if (resumeSeconds > 0) {
      query.set("progress", String(resumeSeconds));
    }
    return `https://player.videasy.net/tv/${mediaId}/${seasonNumber}/${episodeNumber}?${query.toString()}`;
  }, [mediaId, animeType, seasonNumber, episodeNumber, resumeSeconds]);

  const customPlayer = useMemo(() => {
    if (!anime || !mediaId) return undefined;
    const tmdbId = Number(mediaId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return undefined;

    if (animeType === "movie") {
      return {
        videasyRequest: {
          tmdbId,
          mediaType: "movie" as const,
          title: anime.title || anime.name || "Untitled",
          year: String(anime.release_date || anime.first_air_date || "").slice(0, 4),
          imdbId: anime.external_ids?.imdb_id || anime.imdb_id || "",
        },
        continueWatching: {
          storageKey: `continue:anime:movie:${mediaId}`,
          indexEntry: `anime:movie:${mediaId}`,
          mode: "animeMovie" as const,
          tmdbId: String(mediaId),
          title: anime.title || anime.name || "Untitled",
          posterPath: anime.poster_path || null,
        },
      };
    }

    if (seasonNumber <= 0 || episodeNumber <= 0) return undefined;

    return {
      videasyRequest: {
        tmdbId,
        mediaType: "tv" as const,
        title: anime.title || anime.name || "Untitled",
        year: String(anime.first_air_date || anime.release_date || "").slice(0, 4),
        seasonId: seasonNumber,
        episodeId: episodeNumber,
        totalSeasons: Number(anime.number_of_seasons || 0),
        imdbId: anime.external_ids?.imdb_id || anime.imdb_id || "",
      },
      continueWatching: {
        storageKey: `continue:anime:tv:${mediaId}`,
        indexEntry: `anime:tv:${mediaId}`,
        mode: "animeTv" as const,
        tmdbId: String(mediaId),
        title: anime.title || anime.name || "Untitled",
        posterPath: anime.poster_path || null,
        seasonNumber,
        episodeNumber,
      },
    };
  }, [anime, mediaId, animeType, seasonNumber, episodeNumber]);

  const releaseDate = anime?.release_date || anime?.first_air_date || "Unknown";
  const runtime = anime?.runtime || anime?.episode_run_time?.[0];

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

  const title = anime.title || anime.name || "Untitled";
  const posterUrl = anime.poster_path
    ? `https://image.tmdb.org/t/p/w500${anime.poster_path}`
    : "/no-image.svg";
  const backdropUrl = anime.backdrop_path
    ? `https://image.tmdb.org/t/p/original${anime.backdrop_path}`
    : undefined;

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
        customPlayer={customPlayer}
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
