import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export type ContinueWatchingEntry = {
  key: string;
  tmdbId: string;
  mediaType: string;
  title: string;
  posterPath: string | null;
  progress: number;
  timestamp: number;
  duration: number;
  seasonNumber?: number;
  episodeNumber?: number;
  updatedAt: string;
};

function getResumeRoute(entry: ContinueWatchingEntry): string {
  const { mediaType, tmdbId } = entry;
  if (mediaType === "movie") return `/movie/${tmdbId}`;
  if (mediaType === "tv") return `/tv/${tmdbId}`;
  if (mediaType === "anime:movie") return `/anime/${tmdbId}?type=movie`;
  if (mediaType === "anime:tv") return `/anime/${tmdbId}?type=tv`;
  return "/";
}

function getContinueWatchingStorageKey(indexEntry: string): string {
  const parts = indexEntry.split(":");
  if (parts[0] === "movie") return `continue:movie:${parts[1]}`;
  if (parts[0] === "tv") return `continue:tv:${parts[1]}`;
  if (parts[0] === "anime") return `continue:anime:${parts[1]}:${parts[2]}`;
  return "";
}

function parseContinueWatchingKey(
  indexEntry: string
): { mediaType: string; tmdbId: string } | null {
  const parts = indexEntry.split(":");
  if (parts[0] === "movie" && parts[1]) return { mediaType: "movie", tmdbId: parts[1] };
  if (parts[0] === "tv" && parts[1]) return { mediaType: "tv", tmdbId: parts[1] };
  if (parts[0] === "anime" && parts[1] && parts[2]) {
    return { mediaType: `anime:${parts[1]}`, tmdbId: parts[2] };
  }
  return null;
}

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

  const loadEntries = () => {
    try {
      const storedIndex = window.localStorage.getItem("continueWatching:index");
      if (!storedIndex) {
        setEntries([]);
        return;
      }

      const indexEntries: string[] = JSON.parse(storedIndex);
      const loadedEntries: ContinueWatchingEntry[] = [];

      for (const indexEntry of indexEntries) {
        const entryMetadata = parseContinueWatchingKey(indexEntry);
        if (!entryMetadata) continue;

        const storageKey = getContinueWatchingStorageKey(indexEntry);
        if (!storageKey) continue;

        const storedEntry = window.localStorage.getItem(storageKey);
        if (!storedEntry) continue;

        const storedData = JSON.parse(storedEntry);
        if (!storedData.title) continue;

        loadedEntries.push({
          key: indexEntry,
          tmdbId: entryMetadata.tmdbId,
          mediaType: entryMetadata.mediaType,
          title: storedData.title,
          posterPath: storedData.posterPath || null,
          progress: Number(storedData.progress || 0),
          timestamp: Number(storedData.timestamp || 0),
          duration: Number(storedData.duration || 0),
          seasonNumber: storedData.seasonNumber,
          episodeNumber: storedData.episodeNumber,
          updatedAt: storedData.updatedAt || "",
        });
      }

      setEntries(loadedEntries);
    } catch {
      setEntries([]);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const removeEntry = (event: React.MouseEvent, key: string) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      const storageKey = getContinueWatchingStorageKey(key);
      if (storageKey) window.localStorage.removeItem(storageKey);

      const storedIndex = window.localStorage.getItem("continueWatching:index");
      if (storedIndex) {
        const indexEntries: string[] = JSON.parse(storedIndex);
        window.localStorage.setItem(
          "continueWatching:index",
          JSON.stringify(indexEntries.filter((indexEntry) => indexEntry !== key))
        );
      }

      loadEntries();
    } catch {}
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
