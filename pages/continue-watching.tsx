import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { ContinueWatchingEntry } from "../components/ContinueWatchingRow";

function buildDetailUrl(entry: ContinueWatchingEntry, play = false): string {
  const { mediaType, tmdbId } = entry;
  const playSuffix = play ? "play=1" : "";
  if (mediaType === "movie") return `/movie/${tmdbId}${play ? `?${playSuffix}` : ""}`;
  if (mediaType === "tv") return `/tv/${tmdbId}${play ? `?${playSuffix}` : ""}`;
  if (mediaType === "anime:movie") return `/anime/${tmdbId}?type=movie${play ? `&${playSuffix}` : ""}`;
  if (mediaType === "anime:tv") return `/anime/${tmdbId}?type=tv${play ? `&${playSuffix}` : ""}`;
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

function formatMediaLabel(mediaType: string): string {
  if (mediaType === "movie") return "Movie";
  if (mediaType === "tv") return "Series";
  if (mediaType === "anime:movie") return "Anime Film";
  if (mediaType === "anime:tv") return "Anime";
  return "";
}

export default function ContinueWatchingPage() {
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

  const handleRemove = (key: string) => {
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

  const handleClearAll = () => {
    try {
      const indexRaw = window.localStorage.getItem("continueWatching:index");
      if (indexRaw) {
        const index: string[] = JSON.parse(indexRaw);
        for (const entry of index) {
          const storageKey = getStorageKey(entry);
          if (storageKey) window.localStorage.removeItem(storageKey);
        }
      }
      window.localStorage.removeItem("continueWatching:index");
      setEntries([]);
    } catch {
      // Ignore errors.
    }
  };

  if (!mounted) return <div className="loading">Loading...</div>;

  return (
    <div className="home discover-home">
      <main className="page-shell">
        <section className="cw-page">
          <div className="page-header">
            <div>
              <h1 className="page-title">Continue Watching</h1>
              <p className="page-subtitle">Pick up where you left off</p>
            </div>
            {entries.length > 0 && (
              <button className="cw-clear-btn" onClick={handleClearAll}>
                Clear all
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="cw-empty">
              <div className="cw-empty-icon">▶</div>
              <h3>Nothing here yet</h3>
              <p>Start watching a movie, series, or anime and it will appear here.</p>
              <button onClick={() => router.push("/")}>Browse content</button>
            </div>
          ) : (
            <div className="cw-page-grid">
              {entries.map((entry) => {
                const posterUrl = entry.posterPath
                  ? `https://image.tmdb.org/t/p/w500${entry.posterPath}`
                  : "/no-image.svg";
                const url = buildDetailUrl(entry);
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
                    className="cw-page-card"
                    onClick={() => router.push(url)}
                  >
                    <div className="cw-page-poster-wrap">
                      <img src={posterUrl} alt={entry.title} />
                      {progressPct > 0 && (
                        <div className="cw-progress-bar">
                          <div
                            className="cw-progress-fill"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}
                      <div className="cw-page-badge">
                        {formatMediaLabel(entry.mediaType)}
                      </div>
                    </div>
                    <div className="cw-page-card-body">
                      <h3 className="cw-page-card-title">{entry.title}</h3>
                      {subtitle && <p className="cw-subtitle">{subtitle}</p>}
                      {entry.timestamp > 0 && entry.duration > 0 && (
                        <p className="cw-time-left">
                          {formatProgress(entry.timestamp, entry.duration)}
                        </p>
                      )}
                      {progressPct > 0 && (
                        <p className="cw-pct">{Math.round(progressPct)}% watched</p>
                      )}
                      <button
                        className="cw-resume-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(buildDetailUrl(entry, true));
                        }}
                      >
                        ▶ Resume
                      </button>
                      <button
                        className="cw-remove-full-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(entry.key);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
