import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ContinueWatchingRow from "../components/ContinueWatchingRow";
import MediaRow, { MediaRowItem } from "../components/MediaRow";
import Billboard, { BillboardItem } from "../components/Billboard";
import { getDetailRoute, getMediaType, isAnimeItem } from "../utils/mediaRouting";

type MediaType = "movie" | "tv";

type MediaItem = {
  id: number;
  media_type?: MediaType;
  genre_ids?: number[];
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  vote_average?: number;
  popularity?: number;
};

type FilterType = "all" | MediaType | "anime";

const ROW_TITLES: Record<string, string> = {
  trending: "Trending Now",
  anime: "Popular Anime",
  nowPlaying: "Now Playing in Theaters",
  popularMovies: "Popular Movies",
  topRatedMovies: "Top Rated Movies",
  upcomingMovies: "Coming Soon",
  airingToday: "Airing Today",
  onTheAir: "New Episodes This Week",
};

export default function Home() {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<Record<string, MediaItem[]>>({});
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const decorateResults = (items: MediaItem[], forcedType?: MediaType) =>
    items
      .filter((item) => item?.id)
      .map((item) => ({
        ...item,
        media_type: forcedType || getMediaType(item),
      }))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  useEffect(() => {
    const fetchTrending = async () => {
      const [movieRes, tvRes] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/trending/movie/day`, {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        }),
        axios.get(`https://api.themoviedb.org/3/trending/tv/day`, {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        }),
      ]);

      const movies = decorateResults(movieRes.data.results || [], "movie");
      const shows = decorateResults(tvRes.data.results || [], "tv");
      setTrending([...movies.slice(0, 6), ...shows.slice(0, 6)]);
    };

    const fetchSearchResults = async (searchQuery: string) => {
      const [moviesRes, tvRes] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/search/movie`, {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY, query: searchQuery },
        }),
        axios.get(`https://api.themoviedb.org/3/search/tv`, {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY, query: searchQuery },
        }),
      ]);

      const movieResults = decorateResults(moviesRes.data.results || [], "movie");
      const tvResults = decorateResults(tvRes.data.results || [], "tv");
      setSearchResults([...movieResults, ...tvResults]);
    };

    const fetchCategories = async () => {
      const endpoints = {
        trending: `https://api.themoviedb.org/3/trending/all/day`,
        anime: `https://api.themoviedb.org/3/discover/tv`,
        nowPlaying: `https://api.themoviedb.org/3/movie/now_playing`,
        popularMovies: `https://api.themoviedb.org/3/movie/popular`,
        topRatedMovies: `https://api.themoviedb.org/3/movie/top_rated`,
        upcomingMovies: `https://api.themoviedb.org/3/movie/upcoming`,
        airingToday: `https://api.themoviedb.org/3/tv/airing_today`,
        onTheAir: `https://api.themoviedb.org/3/tv/on_the_air`,
      };

      const entries = Object.entries(endpoints);
      const responses = await Promise.all(
        entries.map(([key, url]) =>
          axios.get(url, {
            params:
              key === "anime"
                ? {
                    api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
                    with_genres: 16,
                    with_original_language: "ja",
                    sort_by: "popularity.desc",
                  }
                : { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
          })
        )
      );

      const categoryData: Record<string, MediaItem[]> = {};
      entries.forEach(([key], index) => {
        categoryData[key] = decorateResults(responses[index].data.results || []);
      });

      setCategories(categoryData);
    };

    const searchQuery = Array.isArray(router.query.query)
      ? router.query.query[0]
      : router.query.query;

    const initialize = async () => {
      try {
        setIsLoading(true);
        setError("");

        if (searchQuery) {
          setQuery(searchQuery);
          setSearchInput(searchQuery);
          await fetchSearchResults(searchQuery);
        } else {
          setQuery("");
          setSearchInput("");
          setSearchResults([]);
          await Promise.all([fetchTrending(), fetchCategories()]);
        }
      } catch {
        setError("Something went wrong while loading content. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [router.query]);

  const filteredResults = useMemo(() => {
    if (activeFilter === "all") return searchResults;
    if (activeFilter === "anime") return searchResults.filter((item) => isAnimeItem(item));
    return searchResults.filter((item) => getMediaType(item) === activeFilter);
  }, [activeFilter, searchResults]);

  const featured = useMemo(
    () =>
      [...trending]
        .filter((item) => item.backdrop_path && item.overview)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 6),
    [trending]
  );

  const openDetails = (item: MediaItem, play = false) => {
    router.push(getDetailRoute(item, { play }));
  };

  const handleRefinedSearch = () => {
    if (!searchInput.trim()) return;
    router.push({ pathname: "/", query: { query: searchInput.trim() } });
  };

  const getTitle = (item: MediaItem) => item.title || item.name || "Untitled";
  const getYear = (item: MediaItem) =>
    item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || "N/A";
  const getPoster = (item: MediaItem) =>
    item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/no-image.svg";

  const itemKey = (item: MediaItem) => `${getMediaType(item)}-${item.id}`;

  const billboardItems: BillboardItem[] = featured.map((item) => ({
    id: itemKey(item),
    title: getTitle(item),
    backdropUrl: `https://image.tmdb.org/t/p/original${item.backdrop_path}`,
    overview: item.overview,
    rating: item.vote_average,
    year: getYear(item) === "N/A" ? undefined : getYear(item),
    typeLabel: getMediaType(item) === "tv" ? "SERIES" : "MOVIE",
  }));

  const handleBillboardAction = (play: boolean) => (billboardItem: BillboardItem) => {
    const match = featured.find((item) => itemKey(item) === billboardItem.id);
    if (match) openDetails(match, play);
  };

  const toRowItems = (items: MediaItem[]): MediaRowItem[] =>
    items.slice(0, 18).map((item) => ({
      id: itemKey(item),
      title: getTitle(item),
      posterUrl: getPoster(item),
      year: getYear(item) === "N/A" ? undefined : getYear(item),
      rating: item.vote_average,
    }));

  const handleRowClick = (items: MediaItem[]) => (row: MediaRowItem) => {
    const match = items.find((item) => itemKey(item) === row.id);
    if (match) openDetails(match);
  };

  return (
    <div className="home discover-home">
      {query ? (
        <main className="container discover-shell">
          <section className="discover-search-panel">
            <div className="discover-search-header">
              <h1>Search Results</h1>
              <p>
                Showing titles for <strong>{query}</strong>
              </p>
            </div>

            <div className="discover-refine-row">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRefinedSearch();
                }}
                placeholder="Refine your search"
                aria-label="Refine search"
              />
              <button onClick={handleRefinedSearch}>Search</button>
            </div>

            <div className="discover-filter-row">
              <button
                className={activeFilter === "all" ? "discover-chip active" : "discover-chip"}
                onClick={() => setActiveFilter("all")}
              >
                All ({searchResults.length})
              </button>
              <button
                className={activeFilter === "movie" ? "discover-chip active" : "discover-chip"}
                onClick={() => setActiveFilter("movie")}
              >
                Movies ({searchResults.filter((item) => getMediaType(item) === "movie").length})
              </button>
              <button
                className={activeFilter === "tv" ? "discover-chip active" : "discover-chip"}
                onClick={() => setActiveFilter("tv")}
              >
                TV Shows ({searchResults.filter((item) => getMediaType(item) === "tv").length})
              </button>
              <button
                className={activeFilter === "anime" ? "discover-chip active" : "discover-chip"}
                onClick={() => setActiveFilter("anime")}
              >
                Anime ({searchResults.filter((item) => isAnimeItem(item)).length})
              </button>
            </div>

            {isLoading ? <div className="loading">Searching titles</div> : null}
            {error ? <p className="discover-error">{error}</p> : null}

            {!isLoading && !error && filteredResults.length === 0 ? (
              <div className="discover-empty">
                <h3>No results found</h3>
                <p>Try a different keyword or switch to another filter.</p>
              </div>
            ) : null}

            <div className="discover-grid">
              {filteredResults.map((item) => (
                <article
                  key={itemKey(item)}
                  className="discover-card"
                  onClick={() => openDetails(item)}
                >
                  <img src={getPoster(item)} alt={getTitle(item)} />
                  <div className="discover-card-content">
                    <span className="discover-pill">{isAnimeItem(item) ? "ANIME" : getMediaType(item).toUpperCase()}</span>
                    <h3>{getTitle(item)}</h3>
                    <p>{getYear(item)} • ⭐ {(item.vote_average || 0).toFixed(1)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <>
          {billboardItems.length ? (
            <Billboard
              items={billboardItems}
              getKicker={(_, index) => `#${index + 1} Trending Today`}
              onPlay={handleBillboardAction(true)}
              onInfo={handleBillboardAction(false)}
            />
          ) : (
            <div className="billboard-loading">
              <div className="loading">Loading</div>
            </div>
          )}

          <main className="home-rows">
            {error ? <p className="discover-error">{error}</p> : null}

            <ContinueWatchingRow maxItems={12} showViewAll={true} />

            {Object.entries(categories).map(([key, items]) => (
              <MediaRow
                key={key}
                title={
                  ROW_TITLES[key] ||
                  key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
                }
                items={toRowItems(items)}
                onItemClick={handleRowClick(items)}
              />
            ))}
          </main>
        </>
      )}
    </div>
  );
}
