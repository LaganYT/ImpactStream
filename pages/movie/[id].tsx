import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  buildDownloadUrl,
  fetchVideasyDownloadData,
  SourceItem,
  SubtitleItem,
} from "../../utils/videasyDownloader";

export default function MovieDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadSources, setDownloadSources] = useState<SourceItem[]>([]);
  const [downloadSubtitles, setDownloadSubtitles] = useState<SubtitleItem[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      const endpoint = "movie"; // Fixed to always use "movie"
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/${endpoint}/${id}`,
        {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        }
      );
      setMovie(data);
    };

    fetchDetails();
  }, [id]);

  if (!movie) return <div className="loading">Loading...</div>;

  const runtime = movie.runtime || movie.episode_run_time?.[0];
  const releaseDate = movie.release_date || movie.first_air_date;

  const handleDownload = async () => {
    const tmdbId = Number(Array.isArray(id) ? id[0] : id);
    if (!tmdbId) return;

    try {
      setIsDownloading(true);
      setDownloadError("");

      const title = movie.title || "Movie";
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
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe
          name="framez"
          id="framez"
          src={`https://player.videasy.net/movie/${id}?color=e50914&nextEpisode=true&episodeSelector=true`}
          allowFullScreen
          className="movie-iframe"
        ></iframe>
      </div>
      <div className="api-selector">
        <button onClick={handleDownload} style={{ marginLeft: 12 }} disabled={isDownloading}>
          {isDownloading ? "Decoding..." : "Download"}
        </button>
      </div>
      <div className="movie-card">
        <div className="movie-header">
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="movie-poster"
          />
          <div className="movie-info">
            <h1 className="movie-title">{movie.title}</h1>
            <p className="movie-description">{movie.overview}</p>
            <div className="movie-metadata">
              <span>Release: {releaseDate}</span>
              <span>Rating: {movie.vote_average}</span>
              <span>Runtime: {runtime} min</span>
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
                              href={buildDownloadUrl(src.url, downloadTitle || movie.title || "video")}
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






