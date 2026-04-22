import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  ContinueWatchingItem,
  continueWatchingHref,
  hydrateContinueWatchingItems,
  readContinueWatchingProgress,
} from "../lib/continueWatching";

export default function ContinueWatchingPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      setIsLoading(true);
      const saved = readContinueWatchingProgress();
      const hydrated = await hydrateContinueWatchingItems(saved);
      setItems(hydrated);
      setIsLoading(false);
    };

    loadItems();
  }, []);

  const hasItems = useMemo(() => items.length > 0, [items.length]);

  return (
    <div className="home discover-home">
      <main className="container discover-shell continue-page-shell">
        <section className="continue-page-header">
          <h1>Continue Watching</h1>
          <p>Pick up right where you left off across movies, TV shows, and anime.</p>
        </section>

        {isLoading ? <div className="loading">Loading watch progress...</div> : null}

        {!isLoading && !hasItems ? (
          <section className="discover-empty continue-empty">
            <h3>No watch history yet</h3>
            <p>Start a movie or show and your progress will appear here.</p>
          </section>
        ) : null}

        {hasItems ? (
          <section className="continue-grid">
            {items.map((item) => (
              <article
                key={`${item.kind}-${item.id}`}
                className="discover-card continue-card"
                onClick={() => router.push(continueWatchingHref(item))}
              >
                <img
                  src={item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : "/no-image.svg"}
                  alt={item.title}
                />
                <div className="discover-card-content">
                  <span className="discover-pill">
                    {item.kind === "anime-tv" || item.kind === "anime-movie"
                      ? "ANIME"
                      : item.kind === "movie"
                        ? "MOVIE"
                        : "TV"}
                  </span>
                  <h3>{item.title}</h3>
                  <p>
                    {item.kind.includes("tv")
                      ? `Season ${item.seasonNumber} • Episode ${item.episodeNumber}`
                      : `${Math.round(item.progress)}% watched`}
                  </p>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
