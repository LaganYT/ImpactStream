import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [categories, setCategories] = useState<Record<string, any[]>>({}); // Explicitly typed
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

    const fetchCategories = async () => {
      const endpoints = {
        trending: `https://api.themoviedb.org/3/trending/all/day`, // Explicitly added trending
        nowPlaying: `https://api.themoviedb.org/3/movie/now_playing`,
        popularMovies: `https://api.themoviedb.org/3/movie/popular`,
        topRatedMovies: `https://api.themoviedb.org/3/movie/top_rated`,
        upcomingMovies: `https://api.themoviedb.org/3/movie/upcoming`,
        airingToday: `https://api.themoviedb.org/3/tv/airing_today`,
        onTheAir: `https://api.themoviedb.org/3/tv/on_the_air`,
      };

      const categoryData: Record<string, any[]> = {};
      for (const [key, url] of Object.entries(endpoints)) {
        const { data } = await axios.get(url, {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        });
        categoryData[key] = data.results;
      }
      setCategories(categoryData);
    };

    const searchQuery = Array.isArray(router.query.query)
      ? router.query.query[0]
      : router.query.query;

    if (searchQuery) {
      setQuery(searchQuery);
      fetchSearchResults(searchQuery);
    } else {
      fetchTrending();
      fetchCategories();
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
          <div className="hero-features">
            <a href="/live-tv" className="feature-card">
              <div className="feature-icon">📺</div>
              <div className="feature-text">
                <h3>Live TV</h3>
                <p>Watch live channels from around the world</p>
              </div>
            </a>
          </div>
          <p style={{ color: "#f5f5f5", fontSize: "0.9rem", marginTop: "1rem" }}>
            <strong>Note:</strong> We recommend using an ad blocker for a better experience. You can use {" "}
            <a 
              href="https://chromewebstore.google.com/detail/adblock-%E2%80%94-block-ads-acros/gighmmpiobklfepjocnamgkkbiglidom?hl=en-US" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: "#e50914", textDecoration: "underline" }}
            >
              AdBlock
            </a> {" "}or try the{" "}
            <a 
              href="https://brave.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: "#e50914", textDecoration: "underline" }}
            >
              Brave browser
            </a>.
          </p>
        </header>
        {query ? (
          <section className="search-results">
            <h2>Search Results for "{query}"</h2>
            <div className="search-scroll">
              {trending.map((item: any) => (
                <div
                  key={item.id}
                  className="search-item"
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
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="categories">
            {Object.entries(categories).map(([key, items]) => (
              <div key={key} className="category">
                <h3>
                  {key === "trending"
                    ? "Trending Now"
                    : key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                </h3>
                <div className="category-scroll">
                  {items.map((item: any) => (
                    <div
                      key={item.id}
                      className="category-item"
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
                      <h4>{item.title || item.name}</h4>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
