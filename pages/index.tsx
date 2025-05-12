import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchTrending = async () => {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/trending/all/day`,
        {
          params: {
            api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
          },
        }
      );
      setTrending(data.results);
    };

    fetchTrending();
  }, []);

  const searchContent = async () => {
    const { data } = await axios.get(
      `https://api.themoviedb.org/3/search/multi`,
      {
        params: {
          api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
          query,
        },
      }
    );
    setTrending(data.results);
  };

  return (
    <div className="bg-background min-h-screen text-white">
      {/* Navbar */}
      <div className="bg-navbar p-4 flex justify-between items-center shadow-lg">
        <h1 className="text-3xl font-bold text-accent">ImpactStream</h1>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search..."
            className="p-2 rounded bg-input text-white"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={searchContent}
            className="bg-accent text-white px-4 py-2 rounded hover:bg-accentHover transition"
          >
            Search
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-card p-8 rounded-lg text-center mb-8 mt-4 animate-fadeIn">
        <h1 className="text-4xl font-bold text-accent mb-4">
          Welcome to ImpactStream
        </h1>
        <p className="text-textSecondary">
          Discover and stream your favorite movies, TV shows, and anime all in
          one place.
        </p>
      </div>

      {/* Trending Section */}
      <h2 className="text-2xl font-bold mb-4">Trending Now</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {trending.map((item: any) => (
          <div
            key={item.id}
            className="bg-card p-2 rounded cursor-pointer shadow-lg transition-transform duration-300 hover:scale-105"
            onClick={() => router.push(`/movie/${item.id}`)}
          >
            <img
              src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
              alt={item.title || item.name}
              className="rounded"
            />
            <h3 className="text-sm mt-2 text-textPrimary">
              {item.title || item.name}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
}
