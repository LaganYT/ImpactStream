import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  fetchVideasyDownloadData,
  SourceItem,
  SubtitleItem,
} from "../../utils/videasyDownloader";
import { getMediaType, isAnimeItem, RoutableMediaItem } from "../../utils/mediaRouting";
import { useTitleModal } from "../../components/TitleModal";
import MediaDetailShell from "../../components/MediaDetailShell";
import DownloadModal from "../../components/DownloadModal";
import EpisodeList, { EpisodeInfo } from "../../components/EpisodeList";
import MediaRow, { MediaRowItem } from "../../components/MediaRow";

type RecommendationItem = RoutableMediaItem & {
  title?: string;
  name?: string;
  poster_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
};

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
  recommendations?: { results?: RecommendationItem[] };
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

export default function TVDetailsPage() {
  const router = useRouter();
  const { openTitle } = useTitleModal();
  const { id } = router.query;
  const [tvShow, setTVShow] = useState<TVDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
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
        params: {
          api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
          append_to_response: "recommendations",
        },
      });
      setTVShow(data);
    };

    fetchTVShow();
  }, [id]);

  useEffect(() => {
    if (!id || !tvShow) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;
    const indexKey = "continueWatching:index";

    try {
      const existing = window.localStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : {};
      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const entry = `tv:${storageId}`;
      const nextData = {
        ...parsed,
        title: tvShow.name || parsed.title,
        posterPath: tvShow.poster_path || parsed.posterPath,
        mediaType: "tv",
        tmdbId: storageId,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextData));

      const filtered = index.filter((e) => e !== entry);
      if (shouldTrackContinueWatching(nextData)) {
        filtered.unshift(entry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    } catch {
      // Ignore storage errors.
    }
  }, [id, tvShow]);

  useEffect(() => {
    if (!id) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;

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
  }, [id]);

  useEffect(() => {
    if (!tvShow || !id || !isProgressLoaded) return;

    const fetchSeason = async () => {
      try {
        const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`, {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        });
        const seasonEpisodes: EpisodeInfo[] = Array.isArray(data.episodes) ? data.episodes : [];
        setEpisodes(seasonEpisodes);
        setEpisodeNumber((current) => {
          if (seasonEpisodes.length === 0) return 0;
          if (current > seasonEpisodes.length) return 1;
          return current > 0 ? current : 1;
        });
      } catch {
        setEpisodes([]);
        setEpisodeNumber(0);
      }
    };

    fetchSeason();
  }, [tvShow, id, seasonNumber, isProgressLoaded]);

  useEffect(() => {
    if (!id || !isProgressLoaded || seasonNumber <= 0 || episodeNumber <= 0) return;

    const storageId = Array.isArray(id) ? id[0] : id;
    const storageKey = `continue:tv:${storageId}`;
    const indexKey = "continueWatching:index";
    const entry = `tv:${storageId}`;

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
      if (payloadSeason > 0 && payloadEpisode > 0) {
        if (payloadSeason !== seasonNumber) {
          setSeasonNumber(payloadSeason);
        }
        if (payloadEpisode !== episodeNumber) {
          setEpisodeNumber(payloadEpisode);
        }
      }

      const timestamp = Math.max(0, Math.floor(Number(payload.timestamp || 0)));
      const duration = Math.max(0, Math.floor(Number(payload.duration || 0)));
      const progress = Math.max(0, Math.min(100, Number(payload.progress || 0)));
      const nextSeason = payloadSeason > 0 ? payloadSeason : seasonNumber;
      const nextEpisode = payloadEpisode > 0 ? payloadEpisode : episodeNumber;
      const nextData = {
        seasonNumber: nextSeason,
        episodeNumber: nextEpisode,
        timestamp,
        duration,
        progress,
        updatedAt: new Date().toISOString(),
        title: tvShow?.name || undefined,
        posterPath: tvShow?.poster_path || undefined,
        mediaType: "tv",
        tmdbId: storageId,
      };

      window.localStorage.setItem(
        storageKey,
        JSON.stringify(nextData)
      );

      const indexKey = "continueWatching:index";
      const indexRaw = window.localStorage.getItem(indexKey);
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const entry = `tv:${storageId}`;
      const filtered = index.filter((e) => e !== entry);
      if (shouldTrackContinueWatching(nextData)) {
        filtered.unshift(entry);
      }
      window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
    };

    window.addEventListener("message", handleProgressMessage);
    return () => window.removeEventListener("message", handleProgressMessage);
  }, [id, isProgressLoaded, seasonNumber, episodeNumber, tvShow]);

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

  const title = tvShow?.name || "Untitled";
  const year = tvShow?.first_air_date?.slice(0, 4);

  const tags = useMemo(
    () => (tvShow?.genres || []).slice(0, 6).map((genre) => genre.name),
    [tvShow?.genres]
  );

  const recommendations = useMemo(
    () => (tvShow?.recommendations?.results || []).filter((item) => item.poster_path),
    [tvShow?.recommendations]
  );

  const recommendationRowItems: MediaRowItem[] = recommendations.slice(0, 18).map((item) => ({
    id: item.id,
    title: item.name || item.title || "Untitled",
    posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
    year: (item.first_air_date || item.release_date || "").slice(0, 4) || undefined,
    rating: item.vote_average,
  }));

  const handleRecommendationClick = (row: MediaRowItem) => {
    const match = recommendations.find((item) => item.id === row.id);
    if (match) {
      openTitle({ id: match.id, mediaType: getMediaType(match), isAnime: isAnimeItem(match) });
    }
  };

  if (!tvShow) return <div className="loading">Loading...</div>;

  const tvId = Array.isArray(id) ? id[0] : id;
  const tvQuery = new URLSearchParams({
    color: "e50914",
    autoplay: "true",
    nextEpisode: "true",
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

  const activeEpisode = episodes.find((episode) => episode.episode_number === episodeNumber);

  return (
    <>
      <MediaDetailShell
        mediaLabel="Series"
        title={title}
        summary={tvShow.overview || "No overview is available for this series yet."}
        embedUrl={`https://player.videasy.net/tv/${tvId}/${seasonNumber}/${episodeNumber}?${tvQuery.toString()}`}
        rating={tvShow.vote_average}
        metaItems={
          [
            year,
            tvShow.number_of_seasons
              ? `${tvShow.number_of_seasons} Season${tvShow.number_of_seasons > 1 ? "s" : ""}`
              : null,
          ].filter(Boolean) as string[]
        }
        tags={tags}
        actions={
          <button className="btn-more-info" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Decoding..." : "Download"}
          </button>
        }
        infoNote={
          <>
            Now playing: S{seasonNumber} E{episodeNumber}
            {activeEpisode?.name ? ` — ${activeEpisode.name}` : ""}
          </>
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
      >
        <EpisodeList
          episodes={episodes}
          seasonCount={tvShow.number_of_seasons || 1}
          season={seasonNumber}
          activeEpisode={episodeNumber}
          onSeasonChange={(season) => setSeasonNumber(season)}
          onEpisodeSelect={(episode) => setEpisodeNumber(episode)}
        />
      </MediaDetailShell>

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
