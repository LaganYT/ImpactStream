import { useEffect, useState } from "react";
import {
  FaDownload,
  FaPlay,
  FaSearch,
  FaSortNumericDown,
  FaSortNumericUp,
  FaStar,
  FaTh,
  FaThList,
} from "react-icons/fa";
import { daysFromToday, formatShortDate } from "../utils/mediaItems";

export type EpisodeInfo = {
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number | null;
  vote_average?: number;
  air_date?: string | null;
};

type Props = {
  episodes: EpisodeInfo[];
  seasonCount?: number;
  seasons?: number[];
  season: number;
  activeEpisode?: number;
  onSeasonChange: (season: number) => void;
  onEpisodeSelect: (episode: number) => void;
  onEpisodeDownload?: (episode: number) => void;
  downloadingEpisode?: number;
};

type View = "list" | "grid";
const VIEW_KEY = "episodes:view";

const stillUrl = (episode: EpisodeInfo) =>
  episode.still_path ? `https://image.tmdb.org/t/p/w300${episode.still_path}` : "/no-image.svg";

const upcomingLabel = (episode: EpisodeInfo) =>
  episode.air_date && daysFromToday(episode.air_date) > 0
    ? `Airs ${formatShortDate(episode.air_date)}`
    : null;

export default function EpisodeList({
  episodes,
  seasonCount = 1,
  seasons,
  season,
  activeEpisode,
  onSeasonChange,
  onEpisodeSelect,
  onEpisodeDownload,
  downloadingEpisode,
}: Props) {
  const [view, setView] = useState<View>("list");
  const [isNewestFirst, setIsNewestFirst] = useState(false);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(VIEW_KEY) === "grid") setView("grid");
  }, []);

  const changeView = (nextView: View) => {
    setView(nextView);
    window.localStorage.setItem(VIEW_KEY, nextView);
  };

  const seasonOptions = seasons?.length
    ? seasons
    : Array.from({ length: seasonCount }, (_, index) => index + 1);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleEpisodes = episodes
    .filter(
      (episode) =>
        !normalizedQuery ||
        String(episode.episode_number) === normalizedQuery ||
        `${episode.name || ""} ${episode.overview || ""}`.toLowerCase().includes(normalizedQuery)
    )
    .sort((a, b) =>
      isNewestFirst ? b.episode_number - a.episode_number : a.episode_number - b.episode_number
    );

  const renderDownload = (episode: EpisodeInfo) => {
    if (!onEpisodeDownload) return null;
    const isDownloading = downloadingEpisode === episode.episode_number;
    return (
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
    );
  };

  return (
    <section className="episodes-section">
      <div className="episodes-header">
        <div className="episodes-heading">
          <h2>Episodes</h2>
          {seasonOptions.length > 1 ? (
            <select
              className="season-select"
              value={season}
              onChange={(e) => onSeasonChange(Number(e.target.value))}
              aria-label="Select season"
            >
              {seasonOptions.map((s) => (
                <option key={s} value={s}>
                  Season {s}
                </option>
              ))}
            </select>
          ) : (
            <span className="episodes-season-label">Season {season}</span>
          )}
          <span className="episodes-count">{episodes.length} episodes</span>
        </div>

        <div className="episodes-tools">
          {isSearching ? (
            <input
              autoFocus
              type="search"
              className="episodes-search"
              placeholder="Find an episode"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onBlur={() => {
                if (!query) setIsSearching(false);
              }}
              aria-label="Find an episode"
            />
          ) : (
            <button
              className="icon-button tool-button"
              onClick={() => setIsSearching(true)}
              aria-label="Find an episode"
              title="Find an episode"
            >
              <FaSearch />
            </button>
          )}
          <button
            className="icon-button tool-button"
            onClick={() => setIsNewestFirst((value) => !value)}
            aria-label={isNewestFirst ? "Show first episode first" : "Show latest episode first"}
            title={isNewestFirst ? "Latest first" : "First episode first"}
          >
            {isNewestFirst ? <FaSortNumericUp /> : <FaSortNumericDown />}
          </button>
          <div className="tool-segment" role="group" aria-label="Episode layout">
            <button
              className={view === "list" ? "icon-button tool-button active" : "icon-button tool-button"}
              onClick={() => changeView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <FaThList />
            </button>
            <button
              className={view === "grid" ? "icon-button tool-button active" : "icon-button tool-button"}
              onClick={() => changeView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <FaTh />
            </button>
          </div>
        </div>
      </div>

      <div className={view === "grid" ? "episode-grid" : "episode-list"}>
        {visibleEpisodes.map((episode) => {
          const isActive = episode.episode_number === activeEpisode;
          const title = episode.name || `Episode ${episode.episode_number}`;
          const airs = upcomingLabel(episode);
          const rating =
            episode.vote_average && episode.vote_average > 0 ? episode.vote_average.toFixed(1) : null;

          if (view === "grid") {
            return (
              <div
                key={episode.episode_number}
                className={isActive ? "episode-card active" : "episode-card"}
                onClick={() => onEpisodeSelect(episode.episode_number)}
              >
                <img src={stillUrl(episode)} alt="" loading="lazy" />
                {renderDownload(episode)}
                <div className="episode-card-body">
                  <span className="episode-card-kicker">Episode {episode.episode_number}</span>
                  <h4>{title}</h4>
                  {episode.overview ? <p>{episode.overview}</p> : null}
                  <div className="episode-card-meta">
                    <span>
                      <FaPlay aria-hidden /> {airs || (episode.runtime ? `${episode.runtime}m` : "Play")}
                    </span>
                    {rating ? (
                      <span>
                        <FaStar aria-hidden /> {rating}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={episode.episode_number}
              className={isActive ? "episode-row active" : "episode-row"}
              onClick={() => onEpisodeSelect(episode.episode_number)}
            >
              <span className="episode-number">{episode.episode_number}</span>
              <div className="episode-thumb">
                <img src={stillUrl(episode)} alt={title} loading="lazy" />
                <span className="episode-play">
                  <FaPlay />
                </span>
              </div>
              <div className="episode-details">
                <div className="episode-title-row">
                  <h4>{title}</h4>
                  <span>{airs || (episode.runtime ? `${episode.runtime}m` : null)}</span>
                </div>
                {episode.overview ? <p>{episode.overview}</p> : null}
              </div>
              {renderDownload(episode)}
            </div>
          );
        })}
        {episodes.length === 0 ? (
          <p className="episodes-empty">No episodes found for this season.</p>
        ) : visibleEpisodes.length === 0 ? (
          <p className="episodes-empty">No episodes match “{query.trim()}”.</p>
        ) : null}
      </div>
    </section>
  );
}
