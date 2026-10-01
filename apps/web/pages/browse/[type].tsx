import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import PosterGrid from "../../components/PosterGrid";
import { useTitleModal } from "../../components/TitleModal";
import {
  appendUnique,
  mediaItemKey,
  TmdbListItem,
  TmdbPage,
  toPosterGridItem,
  toTitleRef,
} from "../../utils/mediaItems";
import { tmdbFetch } from "../../utils/tmdbClient";

type BrowseType = "movie" | "tv" | "anime";
type SortId = "popular" | "top" | "newest";
type Genre = { id: number; name: string };

const ANIMATION_GENRE_ID = 16;

const PAGE_TITLES: Record<BrowseType, string> = {
  movie: "Movies",
  tv: "TV Shows",
  anime: "Anime",
};

const SORTS: { id: SortId; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "top", label: "Top Rated" },
  { id: "newest", label: "Newest" },
];

export const getServerSideProps: GetServerSideProps = async ({ params }) =>
  params?.type === "movie" || params?.type === "tv" || params?.type === "anime"
    ? { props: {} }
    : { notFound: true };

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function buildDiscoverParams(
  tmdbType: "movie" | "tv",
  browseType: BrowseType,
  genreId: number | null,
  sort: SortId,
  page: number
) {
  const dateField = tmdbType === "movie" ? "primary_release_date" : "first_air_date";
  const today = new Date().toISOString().slice(0, 10);
  const genres = [browseType === "anime" ? ANIMATION_GENRE_ID : null, genreId].filter(Boolean);

  return {
    page,
    include_adult: "false",
    with_genres: genres.length ? genres.join(",") : undefined,
    with_original_language: browseType === "anime" ? "ja" : undefined,
    sort_by:
      sort === "top" ? "vote_average.desc" : sort === "newest" ? `${dateField}.desc` : "popularity.desc",
    "vote_count.gte": sort === "top" ? 300 : sort === "newest" ? 20 : undefined,
    [`${dateField}.lte`]: sort === "newest" ? today : undefined,
  };
}

export default function BrowsePage() {
  const router = useRouter();
  const { openTitle } = useTitleModal();

  const browseType = (firstValue(router.query.type) || "movie") as BrowseType;
  const animeFormat = firstValue(router.query.format) === "movie" ? "movie" : "tv";
  const tmdbType: "movie" | "tv" = browseType === "anime" ? animeFormat : browseType;
  const genreParam = Number(firstValue(router.query.genre));
  const genreId = Number.isFinite(genreParam) && genreParam > 0 ? genreParam : null;
  const sortParam = firstValue(router.query.sort);
  const sort: SortId = SORTS.some((option) => option.id === sortParam)
    ? (sortParam as SortId)
    : "popular";

  const [genres, setGenres] = useState<Genre[]>([]);
  const [items, setItems] = useState<TmdbListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    tmdbFetch<{ genres?: Genre[] }>(`genre/${tmdbType}/list`)
      .then((data) => {
        if (cancelled) return;
        const list = data.genres || [];
        setGenres(
          browseType === "anime" ? list.filter((genre) => genre.id !== ANIMATION_GENRE_ID) : list
        );
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbType, browseType]);

  useEffect(() => {
    if (!router.isReady) return;

    let cancelled = false;
    setItems([]);
    setPage(1);
    setError("");
    setIsLoading(true);

    tmdbFetch<TmdbPage>(
      `discover/${tmdbType}`,
      buildDiscoverParams(tmdbType, browseType, genreId, sort, 1)
    )
      .then((data) => {
        if (cancelled) return;
        setItems(
          appendUnique([], (data.results || []).map((item) => ({ ...item, media_type: tmdbType })))
        );
        setTotalPages(Math.min(data.total_pages || 0, 500));
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong while loading titles. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, tmdbType, browseType, genreId, sort]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setIsLoading(true);
    try {
      const data = await tmdbFetch<TmdbPage>(
        `discover/${tmdbType}`,
        buildDiscoverParams(tmdbType, browseType, genreId, sort, nextPage)
      );
      setItems((current) =>
        appendUnique(current, (data.results || []).map((item) => ({ ...item, media_type: tmdbType })))
      );
      setPage(nextPage);
    } catch {
      setError("Couldn't load more titles.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuery = (changes: Record<string, string | null>) => {
    const nextQuery: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...router.query, ...changes })) {
      if (key !== "type" && typeof value === "string" && value) nextQuery[key] = value;
    }
    router.replace({ pathname: `/browse/${browseType}`, query: nextQuery }, undefined, {
      shallow: true,
      scroll: false,
    });
  };

  const activeGenreName = genres.find((genre) => genre.id === genreId)?.name;

  return (
    <main className="container discover-shell">
      <section className="discover-search-panel">
        <div className="discover-search-header">
          <h1>{activeGenreName ? `${activeGenreName} ${PAGE_TITLES[browseType]}` : PAGE_TITLES[browseType]}</h1>
          <p>
            {SORTS.find((option) => option.id === sort)?.label}{" "}
            {browseType === "anime"
              ? animeFormat === "movie"
                ? "anime movies"
                : "anime series"
              : PAGE_TITLES[browseType].toLowerCase()}
          </p>
        </div>

        <div className="discover-filter-row browse-controls">
          {browseType === "anime" ? (
            <div className="browse-segment" role="group" aria-label="Anime format">
              {(["tv", "movie"] as const).map((format) => (
                <button
                  key={format}
                  className={animeFormat === format ? "discover-chip active" : "discover-chip"}
                  onClick={() => updateQuery({ format: format === "tv" ? null : "movie", genre: null })}
                >
                  {format === "tv" ? "Series" : "Movies"}
                </button>
              ))}
            </div>
          ) : null}
          <div className="browse-segment" role="group" aria-label="Sort by">
            {SORTS.map((option) => (
              <button
                key={option.id}
                className={sort === option.id ? "discover-chip active" : "discover-chip"}
                onClick={() => updateQuery({ sort: option.id === "popular" ? null : option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {genres.length ? (
          <div className="discover-filter-row genre-row" role="group" aria-label="Genres">
            <button
              className={genreId === null ? "discover-chip active" : "discover-chip"}
              onClick={() => updateQuery({ genre: null })}
            >
              All genres
            </button>
            {genres.map((genre) => (
              <button
                key={genre.id}
                className={genreId === genre.id ? "discover-chip active" : "discover-chip"}
                onClick={() => updateQuery({ genre: String(genre.id) })}
              >
                {genre.name}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="discover-error">{error}</p> : null}

        {!isLoading && !error && items.length === 0 ? (
          <div className="discover-empty">
            <h3>No titles found</h3>
            <p>Try another genre or sort order.</p>
          </div>
        ) : null}

        <PosterGrid
          items={items.map(toPosterGridItem)}
          onSelect={(gridItem) => {
            const item = items.find((entry) => mediaItemKey(entry) === gridItem.key);
            if (item) openTitle({ ...toTitleRef(item), isAnime: browseType === "anime" || undefined });
          }}
        />

        {isLoading ? <div className="loading">Loading titles</div> : null}

        {!isLoading && page < totalPages ? (
          <div className="load-more-row">
            <button className="btn-more-info" onClick={loadMore}>
              Load more
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
