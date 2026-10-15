import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { FaTimes } from "react-icons/fa";
import { CardMeta, RowScroller, SectionHeader } from "./MediaRow";
import {
  ContinueWatchingEntry,
  getResumeRoute,
  isEpisodicType,
  listContinueWatching,
  removeProgress,
} from "../utils/continueWatching";
import { posterUrl } from "../utils/posters";

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

  const removeEntry = (key: string) => {
    removeProgress(key);
    loadEntries();
  };

  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, maxItems);

  return (
    <section className="media-row">
      <SectionHeader title="Continue watching" subtitle="Pick up right where you left off" />
      <RowScroller label="Continue watching">
        {visibleEntries.map((entry) => {
          const progressPercent = Math.min(100, Math.max(0, entry.progress));
          const episode =
            isEpisodicType(entry.mediaType) && entry.seasonNumber && entry.episodeNumber
              ? `S${entry.seasonNumber}.E${entry.episodeNumber}`
              : undefined;
          const timeLeft =
            entry.timestamp > 0 && entry.duration > 0
              ? formatTimeRemaining(entry.timestamp, entry.duration)
              : undefined;

          return (
            <div key={entry.key} className="cw-card">
              <button
                type="button"
                className="media-card media-card-poster"
                onClick={() => router.push(getResumeRoute(entry))}
              >
                <span className="media-card-art">
                  <img src={posterUrl(entry.posterPath)} alt="" loading="lazy" />
                  {progressPercent > 0 ? (
                    <span className="cw-progress-bar">
                      <span className="cw-progress-fill" style={{ width: `${progressPercent}%` }} />
                    </span>
                  ) : null}
                </span>
                <span className="media-card-title">{entry.title}</span>
                <CardMeta item={{ highlight: episode, details: [timeLeft] }} />
              </button>
              <button
                className="icon-button cw-remove-btn"
                onClick={() => removeEntry(entry.key)}
                aria-label={`Remove ${entry.title} from continue watching`}
                title="Remove"
              >
                <FaTimes />
              </button>
            </div>
          );
        })}
      </RowScroller>
    </section>
  );
}
