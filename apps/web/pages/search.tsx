import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import PosterGrid from "../components/PosterGrid";
import { useTitleModal } from "../components/TitleModal";
import {
  appendUnique,
  flattenSearchResults,
  matchesType,
  TYPE_FILTERS,
  TypeFilter,
  mediaItemKey,
  TmdbListItem,
  TmdbPage,
  toPosterGridItem,
  toTitleRef,
} from "../utils/mediaItems";
import { tmdbFetch } from "../utils/tmdbClient";

export default function SearchPage() {
  const router = useRouter();
  const { openTitle } = useTitleModal();
  const query = typeof router.query.q === "string" ? router.query.q.trim() : "";
  const filterParam = router.query.type;
  const activeFilter: TypeFilter = TYPE_FILTERS.some((filter) => filter.id === filterParam)
    ? (filterParam as TypeFilter)
    : "all";

  const [results, setResults] = useState<TmdbListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!router.isReady) return;

    setResults([]);
    setPage(1);
    setTotalPages(0);
    setError("");
    if (!query) return;

    let cancelled = false;
    setIsLoading(true);
    tmdbFetch<TmdbPage>("search/multi", { query, page: 1 })
      .then((data) => {
        if (cancelled) return;
        setResults(appendUnique([], flattenSearchResults(data.results || [])));
        setTotalPages(data.total_pages || 0);
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong while searching. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, query]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setIsLoading(true);
    try {
      const data = await tmdbFetch<TmdbPage>("search/multi", {
        query,
        page: nextPage,
      });
      setResults((current) => appendUnique(current, flattenSearchResults(data.results || [])));
      setPage(nextPage);
    } catch {
      setError("Couldn't load more results.");
    } finally {
      setIsLoading(false);
    }
  };

  const setFilter = (filter: TypeFilter) => {
    router.replace(
      { pathname: "/search", query: { q: query, ...(filter === "all" ? {} : { type: filter }) } },
      undefined,
      { shallow: true, scroll: false }
    );
  };

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TYPE_FILTERS.map((filter) => [
          filter.id,
          results.filter((item) => matchesType(item, filter.id)).length,
        ])
      ) as Record<TypeFilter, number>,
    [results]
  );

  const visibleResults = results.filter((item) => matchesType(item, activeFilter));

  return (
    <main className="container discover-shell">
      <section className="discover-search-panel">
        <div className="discover-search-header">
          <h1>{query ? "Search Results" : "Search"}</h1>
          <p>
            {query ? (
              <>
                Showing titles for <strong>{query}</strong>
              </>
            ) : (
              "Start typing in the search bar to find movies, shows, and anime."
            )}
          </p>
        </div>

        {query ? (
          <div className="discover-filter-row">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={activeFilter === filter.id ? "discover-chip active" : "discover-chip"}
                onClick={() => setFilter(filter.id)}
              >
                {filter.label} ({counts[filter.id]})
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="discover-error">{error}</p> : null}

        {query && !isLoading && !error && visibleResults.length === 0 ? (
          <div className="discover-empty">
            <h3>No results found</h3>
            <p>Try a different keyword or switch to another filter.</p>
          </div>
        ) : null}

        <PosterGrid
          items={visibleResults.map(toPosterGridItem)}
          onSelect={(gridItem) => {
            const item = visibleResults.find((result) => mediaItemKey(result) === gridItem.key);
            if (item) openTitle(toTitleRef(item));
          }}
        />

        {isLoading ? <div className="loading">Searching titles</div> : null}

        {!isLoading && query && page < totalPages ? (
          <div className="load-more-row">
            <button className="btn-more-info" onClick={loadMore}>
              Load more results
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
