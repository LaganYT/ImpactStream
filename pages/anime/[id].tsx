import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  buildDownloadUrl,
  fetchVideasyDownloadData,
  SourceItem,
  SubtitleItem,
} from "../../utils/videasyDownloader";

type AnimeType = "movie" | "tv";

type AnimeDetails = {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  imdb_id?: string;
  external_ids?: {
    imdb_id?: string;
  };
};

export default function AnimeDetailsPage() {
  const router = useRouter();
  const { id, type } = router.query;

  const animeType: AnimeType = type === "movie" ? "movie" : "tv";

  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState<number>(1);
  const [episodeNumber, setEpisodeNumber] = useState<number>(1);
  const [episodesCount, setEpisodesCount] = useState<number>(0);
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
    if (!id || animeType !== "tv") return;

    const fetchSeason = async (season: number) => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${season}`,
          { params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY } }
        );
        const count = Array.isArray(data.episodes) ? data.episodes.length : 0;
        setEpisodesCount(count);
        setEpisodeNumber(count > 0 ? 1 : 0);
      } catch {
        setEpisodesCount(0);
        setEpisodeNumber(0);
      }
    };

    fetchSeason(1);
  }, [id, animeType]);

  const handleSeasonChange = async (value: number) => {
    if (!id) return;

    setSeasonNumber(value);
    try {
      const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${value}`, {
        params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
      });
      const count = Array.isArray(data.episodes) ? data.episodes.length : 0;
      setEpisodesCount(count);
      setEpisodeNumber(count > 0 ? 1 : 0);
    } catch {
      setEpisodesCount(0);
      setEpisodeNumber(0);
    }
  };

  const streamUrl = useMemo(() => {
    if (!id) return "";
    if (animeType === "movie") {
      return `https://player.videasy.net/movie/${id}?color=e50914&nextEpisode=true&episodeSelector=true`;
    }

    return `https://player.videasy.net/tv/${id}/${seasonNumber}/${episodeNumber}?color=e50914&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true`;
  }, [id, animeType, seasonNumber, episodeNumber]);

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

  const title = anime.title || anime.name || "Untitled";
  const releaseDate = anime.release_date || anime.first_air_date;
  const runtime = anime.runtime || anime.episode_run_time?.[0];

  return (
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe name="framez" id="framez" src={streamUrl} allowFullScreen className="movie-iframe"></iframe>
      </div>

      {animeType === "tv" ? (
        <div className="tv-selector-container">
          <div className="tv-selector-group">
            <label htmlFor="anime-season-select" className="tv-selector-label">Season:</label>
            <select
              id="anime-season-select"
              className="tv-selector-select"
              value={seasonNumber}
              onChange={(e) => handleSeasonChange(Number(e.target.value))}
            >
              {Array.from({ length: anime.number_of_seasons || 0 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>Season {s}</option>
              ))}
            </select>
          </div>

          <div className="tv-selector-group">
            <label htmlFor="anime-episode-select" className="tv-selector-label">Episode:</label>
            <select
              id="anime-episode-select"
              className="tv-selector-select"
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(Number(e.target.value))}
              disabled={episodesCount === 0}
            >
              {Array.from({ length: episodesCount || 0 }, (_, i) => i + 1).map((ep) => (
                <option key={ep} value={ep}>Episode {ep}</option>
              ))}
            </select>
          </div>

          <button className="tv-download-button" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Decoding..." : "Download"}
          </button>
        </div>
      ) : null}

      {animeType === "movie" ? (
        <div className="api-selector">
          <button className="tv-download-button" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? "Decoding..." : "Download"}
          </button>
        </div>
      ) : null}

      <div className="movie-card">
        <div className="movie-header">
          <img
            src={`https://image.tmdb.org/t/p/w500${anime.poster_path}`}
            alt={title}
            className="movie-poster"
          />
          <div className="movie-info">
            <h1 className="movie-title">{title}</h1>
            <p className="movie-description">{anime.overview}</p>
            <div className="movie-metadata">
              <span>Release: {releaseDate}</span>
              <span>Rating: {anime.vote_average}</span>
              {animeType === "movie" ? (
                <span>Runtime: {runtime} min</span>
              ) : (
                <span>Episodes: {anime.number_of_episodes}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isDownloadModalOpen ? (
        <div className="download-modal-backdrop" onClick={() => setIsDownloadModalOpen(false)}>
          <div className="download-modal" onClick={(e) => e.stopPropagation()}>
            <div className="download-modal-header">
              <h3>{downloadTitle || "Download Sources"}</h3>
              <button
                className="download-modal-close"
                onClick={() => setIsDownloadModalOpen(false)}
                aria-label="Close download popup"
              >
                x
              </button>
            </div>

            {downloadError ? (
              <div className="download-modal-error">{downloadError}</div>
            ) : (
              <div className="download-modal-body">
                <h4>Sources</h4>
                <table className="download-modal-table">
                  <thead>
                    <tr>
                      <th>Quality</th>
                      <th>Open</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downloadSources.length ? (
                      downloadSources.map((src, idx) => (
                        <tr key={`${src.url}-${idx}`}>
                          <td>{src.quality || "Unknown"}</td>
                          <td>
                            <a href={src.url} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </td>
                          <td>
                            <a
                              href={buildDownloadUrl(src.url, downloadTitle || title || "video")}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download
                            </a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>No sources</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <h4>Subtitles</h4>
                <table className="download-modal-table">
                  <thead>
                    <tr>
                      <th>Language</th>
                      <th>Open</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downloadSubtitles.length ? (
                      downloadSubtitles.map((sub, idx) => (
                        <tr key={`${sub.url}-${idx}`}>
                          <td>{sub.language || sub.label || "Unknown"}</td>
                          <td>
                            <a href={sub.url} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </td>
                          <td>
                            <a href={sub.url} target="_blank" rel="noreferrer">
                              Download
                            </a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>No subtitles</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
