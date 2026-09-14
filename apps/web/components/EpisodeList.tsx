import { FaDownload, FaPlay } from "react-icons/fa";

export type EpisodeInfo = {
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number | null;
  air_date?: string;
};

type Props = {
  episodes: EpisodeInfo[];
  seasonCount: number;
  season: number;
  activeEpisode?: number;
  onSeasonChange: (season: number) => void;
  onEpisodeSelect: (episode: number) => void;
  onEpisodeDownload?: (episode: number) => void;
  downloadingEpisode?: number;
};

export default function EpisodeList({
  episodes,
  seasonCount,
  season,
  activeEpisode,
  onSeasonChange,
  onEpisodeSelect,
  onEpisodeDownload,
  downloadingEpisode,
}: Props) {
  return (
    <section className="episodes-section">
      <div className="episodes-header">
        <h2>Episodes</h2>
        {seasonCount > 1 ? (
          <select
            className="season-select"
            value={season}
            onChange={(e) => onSeasonChange(Number(e.target.value))}
            aria-label="Select season"
          >
            {Array.from({ length: seasonCount }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>
                Season {s}
              </option>
            ))}
          </select>
        ) : (
          <span className="episodes-season-label">Season {season}</span>
        )}
      </div>

      <div className="episode-list">
        {episodes.map((episode) => {
          const isActive = episode.episode_number === activeEpisode;
          const isDownloading = downloadingEpisode === episode.episode_number;
          return (
            <div
              key={episode.episode_number}
              className={isActive ? "episode-row active" : "episode-row"}
              onClick={() => onEpisodeSelect(episode.episode_number)}
            >
              <span className="episode-number">{episode.episode_number}</span>
              <div className="episode-thumb">
                <img
                  src={
                    episode.still_path
                      ? `https://image.tmdb.org/t/p/w300${episode.still_path}`
                      : "/no-image.svg"
                  }
                  alt={episode.name || `Episode ${episode.episode_number}`}
                  loading="lazy"
                />
                <span className="episode-play">
                  <FaPlay />
                </span>
              </div>
              <div className="episode-details">
                <div className="episode-title-row">
                  <h4>{episode.name || `Episode ${episode.episode_number}`}</h4>
                  {episode.runtime ? <span>{episode.runtime}m</span> : null}
                </div>
                {episode.overview ? <p>{episode.overview}</p> : null}
              </div>
              {onEpisodeDownload ? (
                <button
                  className={isDownloading ? "episode-download downloading" : "episode-download"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEpisodeDownload(episode.episode_number);
                  }}
                  disabled={isDownloading}
                  aria-label={`Download episode ${episode.episode_number}`}
                  title={isDownloading ? "Decoding..." : "Download episode"}
                >
                  <FaDownload />
                </button>
              ) : null}
            </div>
          );
        })}
        {episodes.length === 0 ? (
          <p className="episodes-empty">No episodes found for this season.</p>
        ) : null}
      </div>
    </section>
  );
}
