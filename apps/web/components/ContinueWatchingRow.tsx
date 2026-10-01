import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  ContinueWatchingEntry,
  getResumeRoute,
  listContinueWatching,
  removeProgress,
} from "../utils/continueWatching";

function formatTimeRemaining(timestamp: number, duration: number): string {
  if (!duration) return "";

  const remainingSeconds = Math.max(0, duration - timestamp);
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  if (remainingMinutes < 1) return "Almost done";
  if (remainingMinutes < 60) return `${remainingMinutes}m left`;

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
}

type ContinueWatchingRowProps = {
  maxItems?: number;
};

export default function ContinueWatchingRow({ maxItems = 12 }: ContinueWatchingRowProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<ContinueWatchingEntry[]>([]);

  const loadEntries = () => setEntries(listContinueWatching());

  useEffect(() => {
    loadEntries();
  }, []);

  const removeEntry = (event: React.MouseEvent, key: string) => {
    event.stopPropagation();
    event.preventDefault();
    removeProgress(key);
    loadEntries();
  };

  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, maxItems);

  return (
    <div className="category discover-category cw-section">
      <div className="cw-section-header">
        <h3 className="cw-heading">Continue Watching</h3>
      </div>
      <div className="category-scroll">
        {visibleEntries.map((entry) => {
          const posterUrl = entry.posterPath
            ? `https://image.tmdb.org/t/p/w500${entry.posterPath}`
            : "/no-image.svg";
          const resumeRoute = getResumeRoute(entry);
          const progressPercent = Math.min(100, Math.max(0, entry.progress));
          const subtitle =
            entry.mediaType === "tv" || entry.mediaType === "anime:tv"
              ? entry.seasonNumber && entry.episodeNumber
                ? `S${entry.seasonNumber} E${entry.episodeNumber}`
                : null
              : null;

          return (
            <div
              key={entry.key}
              className="category-item cw-card"
              onClick={() => router.push(resumeRoute)}
            >
              <div className="cw-poster-wrap">
                <img src={posterUrl} alt={entry.title} />
                <button
                  className="cw-remove-btn"
                  onClick={(event) => removeEntry(event, entry.key)}
                  aria-label={`Remove ${entry.title} from continue watching`}
                  title="Remove"
                >
                  ✕
                </button>
                {progressPercent > 0 ? (
                  <div className="cw-progress-bar">
                    <div className="cw-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                ) : null}
              </div>
              <div className="cw-card-footer">
                <h4 className="cw-title">{entry.title}</h4>
                {subtitle ? <p className="cw-subtitle">{subtitle}</p> : null}
                {entry.timestamp > 0 && entry.duration > 0 ? (
                  <p className="cw-time-left">
                    {formatTimeRemaining(entry.timestamp, entry.duration)}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
