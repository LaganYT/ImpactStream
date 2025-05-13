import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchTrending = async () => {
      const { data: movies } = await axios.get(
        `https://api.themoviedb.org/3/trending/movie/day`,
        {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        }
      );
      const { data: tvShows } = await axios.get(
        `https://api.themoviedb.org/3/trending/tv/day`,
        {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        }
      );
      setTrending([...movies.results, ...tvShows.results]);
    };

    const fetchSearchResults = async (searchQuery) => {
      const { data: movies } = await axios.get(
        `https://api.themoviedb.org/3/search/movie`,
        {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY, query: searchQuery },
        }
      );
      const { data: tvShows } = await axios.get(
        `https://api.themoviedb.org/3/search/tv`,
        {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY, query: searchQuery },
        }
      );
      setTrending([...movies.results, ...tvShows.results]);
    };

    const searchQuery = Array.isArray(router.query.query)
      ? router.query.query[0]
      : router.query.query;

    if (searchQuery) {
      setQuery(searchQuery);
      fetchSearchResults(searchQuery);
    } else {
      fetchTrending();
    }
  }, [router.query]);

  const handleCardClick = (item: any) => {
    const type = item.media_type === "tv" || item.first_air_date ? "tv" : "movie";
    router.push({ pathname: `/${type}/${item.id}` });
  };

  return (
    <div className="home">
      <main className="container">
        <header className="hero">
          <h1>Welcome to ImpactStream</h1>
          <p>
            Discover and stream your favorite movies, TV shows, and anime all in
            one place.
          </p>
        </header>
        {/* Trending/Search Results Section */}
        <section className="trending">
          <h2>{query ? `Search Results for "${query}"` : "Trending Now"}</h2>
          <div className="trending-grid">
            {trending.map((item: any) => (
              <div
                key={item.id}
                className="trending-item"
                onClick={() => handleCardClick(item)}
              >
                <img
                  src={
                    item.poster_path
                      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                      : "/no-image.svg"
                  }
                  alt={item.title || item.name}
                />
                <h3>{item.title || item.name}</h3>
                <span>
                  {
                    item.release_date?.slice(0, 4) ||
                    item.first_air_date?.slice(0, 4) ||
                    ""
                  }
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(item);
                  }}
                >
                  Watch
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
