import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

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

function buildResumeUrl(entry: ContinueWatchingEntry): string {
  const { mediaType, tmdbId } = entry;
  if (mediaType === "movie") return `/movie/${tmdbId}?play=1`;
  if (mediaType === "tv") return `/tv/${tmdbId}?play=1`;
  if (mediaType === "anime:movie") return `/anime/${tmdbId}?type=movie&play=1`;
  if (mediaType === "anime:tv") return `/anime/${tmdbId}?type=tv&play=1`;
  return `/`;
}

function getStorageKey(indexEntry: string): string {
  const parts = indexEntry.split(":");
  if (parts[0] === "movie") return `continue:movie:${parts[1]}`;
  if (parts[0] === "tv") return `continue:tv:${parts[1]}`;
  if (parts[0] === "anime") return `continue:anime:${parts[1]}:${parts[2]}`;
  return "";
}

function parseIndexEntry(indexEntry: string): { mediaType: string; tmdbId: string } | null {
  const parts = indexEntry.split(":");
  if (parts[0] === "movie" && parts[1]) return { mediaType: "movie", tmdbId: parts[1] };
  if (parts[0] === "tv" && parts[1]) return { mediaType: "tv", tmdbId: parts[1] };
  if (parts[0] === "anime" && parts[1] && parts[2]) {
    return { mediaType: `anime:${parts[1]}`, tmdbId: parts[2] };
  }
  return null;
}

function formatProgress(timestamp: number, duration: number): string {
  if (!duration) return "";
  const remaining = Math.max(0, duration - timestamp);
  const mins = Math.floor(remaining / 60);
  if (mins < 1) return "Almost done";
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m left` : `${hrs}h left`;
}

type Props = {
  maxItems?: number;
  showViewAll?: boolean;
};

export default function ContinueWatchingRow({ maxItems = 12, showViewAll = true }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<ContinueWatchingEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  const loadEntries = () => {
    try {
      const indexRaw = window.localStorage.getItem("continueWatching:index");
      if (!indexRaw) {
        setEntries([]);
        return;
      }

      const index: string[] = JSON.parse(indexRaw);
      const loaded: ContinueWatchingEntry[] = [];

      for (const indexEntry of index) {
        const meta = parseIndexEntry(indexEntry);
        if (!meta) continue;

        const storageKey = getStorageKey(indexEntry);
        if (!storageKey) continue;

        const raw = window.localStorage.getItem(storageKey);
        if (!raw) continue;

        const data = JSON.parse(raw);
        if (!data.title) continue;

        loaded.push({
          key: indexEntry,
          tmdbId: meta.tmdbId,
          mediaType: meta.mediaType,
          title: data.title,
          posterPath: data.posterPath || null,
          progress: Number(data.progress || 0),
          timestamp: Number(data.timestamp || 0),
          duration: Number(data.duration || 0),
          seasonNumber: data.seasonNumber,
          episodeNumber: data.episodeNumber,
          updatedAt: data.updatedAt || "",
        });
      }

      setEntries(loaded);
    } catch {
      setEntries([]);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadEntries();
  }, []);

  const handleRemove = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const storageKey = getStorageKey(key);
      if (storageKey) window.localStorage.removeItem(storageKey);

      const indexRaw = window.localStorage.getItem("continueWatching:index");
      if (indexRaw) {
        const index: string[] = JSON.parse(indexRaw);
        window.localStorage.setItem(
          "continueWatching:index",
          JSON.stringify(index.filter((e) => e !== key))
        );
      }
      loadEntries();
    } catch {
      // Ignore errors.
    }
  };

  if (!mounted || entries.length === 0) return null;

  const visible = entries.slice(0, maxItems);

  return (
    <div className="category discover-category cw-section">
      <div className="cw-section-header">
        <h3 className="cw-heading">Continue Watching</h3>
        {showViewAll && entries.length > 0 && (
          <Link href="/continue-watching" className="cw-view-all">
            View all ({entries.length})
          </Link>
        )}
      </div>
      <div className="category-scroll">
        {visible.map((entry) => {
          const posterUrl = entry.posterPath
            ? `https://image.tmdb.org/t/p/w500${entry.posterPath}`
            : "/no-image.svg";
          const url = buildResumeUrl(entry);
          const progressPct = Math.min(100, Math.max(0, entry.progress));
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
              onClick={() => router.push(url)}
            >
              <div className="cw-poster-wrap">
                <img src={posterUrl} alt={entry.title} />
                <button
                  className="cw-remove-btn"
                  onClick={(e) => handleRemove(e, entry.key)}
                  aria-label={`Remove ${entry.title} from continue watching`}
                  title="Remove"
                >
                  ✕
                </button>
                {progressPct > 0 && (
                  <div className="cw-progress-bar">
                    <div className="cw-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                )}
              </div>
              <div className="cw-card-footer">
                <h4 className="cw-title">{entry.title}</h4>
                {subtitle && <p className="cw-subtitle">{subtitle}</p>}
                {entry.timestamp > 0 && entry.duration > 0 && (
                  <p className="cw-time-left">{formatProgress(entry.timestamp, entry.duration)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
