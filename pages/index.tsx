import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

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

  const normalizeMediaType = (item: MediaItem): MediaType =>
    item.media_type === "tv" || Boolean(item.first_air_date) ? "tv" : "movie";

  const isAnime = (item: MediaItem) =>
    Boolean(item.genre_ids?.includes(16) && (item.original_language === "ja" || normalizeMediaType(item) === "tv"));

  const decorateResults = (items: MediaItem[], forcedType?: MediaType) =>
    items
      .filter((item) => item?.id)
      .map((item) => ({
        ...item,
        media_type: forcedType || normalizeMediaType(item),
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
    if (activeFilter === "anime") return searchResults.filter((item) => isAnime(item));
    return searchResults.filter((item) => normalizeMediaType(item) === activeFilter);
  }, [activeFilter, searchResults]);

  const handleCardClick = (item: MediaItem) => {
    if (isAnime(item)) {
      const type = normalizeMediaType(item);
      router.push({ pathname: `/anime/${item.id}`, query: { type } });
      return;
    }

    const type = normalizeMediaType(item);
    router.push({ pathname: `/${type}/${item.id}` });
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
  const heroSpotlight = trending[0];

  return (
    <div className="home discover-home">
      <main className="container discover-shell">
        {query ? (
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
                Movies ({searchResults.filter((item) => normalizeMediaType(item) === "movie").length})
              </button>
              <button
                className={activeFilter === "tv" ? "discover-chip active" : "discover-chip"}
                onClick={() => setActiveFilter("tv")}
              >
                TV Shows ({searchResults.filter((item) => normalizeMediaType(item) === "tv").length})
              </button>
              <button
                className={activeFilter === "anime" ? "discover-chip active" : "discover-chip"}
                onClick={() => setActiveFilter("anime")}
              >
                Anime ({searchResults.filter((item) => isAnime(item)).length})
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
                  key={`${normalizeMediaType(item)}-${item.id}`}
                  className="discover-card"
                  onClick={() => handleCardClick(item)}
                >
                  <img src={getPoster(item)} alt={getTitle(item)} />
                  <div className="discover-card-content">
                    <span className="discover-pill">{isAnime(item) ? "ANIME" : normalizeMediaType(item).toUpperCase()}</span>
                    <h3>{getTitle(item)}</h3>
                    <p>{getYear(item)} • ⭐ {(item.vote_average || 0).toFixed(1)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="discover-hero">
              <div className="discover-hero-copy">
                <p className="discover-kicker">Stream Smarter</p>
                <h1>Find movies and shows worth your time.</h1>
                <p>
                  Browse trending picks, jump into Live TV, and open details pages with
                  cleaner controls and faster discovery.
                </p>
                <a href="/live-tv" className="discover-live-link">
                  Explore Live TV
                </a>
              </div>
              {heroSpotlight ? (
                <div className="discover-spotlight" onClick={() => handleCardClick(heroSpotlight)}>
                  <img
                    src={
                      heroSpotlight.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${heroSpotlight.backdrop_path}`
                        : getPoster(heroSpotlight)
                    }
                    alt={getTitle(heroSpotlight)}
                  />
                  <div className="discover-spotlight-overlay">
                    <span>Spotlight</span>
                    <h3>{getTitle(heroSpotlight)}</h3>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="categories">
              {Object.entries(categories).map(([key, items]) => (
                <div key={key} className="category discover-category">
                  <h3>
                    {key === "trending"
                      ? "Trending Now"
                      : key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                  </h3>
                  <div className="category-scroll">
                    {items.slice(0, 18).map((item) => (
                      <div
                        key={`${normalizeMediaType(item)}-${item.id}`}
                        className="category-item"
                        onClick={() => handleCardClick(item)}
                      >
                        <img src={getPoster(item)} alt={getTitle(item)} />
                        <h4>{getTitle(item)}</h4>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
