import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [trending, setTrending] = useState([]);
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

  return (
    <div className="container mx-auto p-4">
      {/* Hero Section */}
      <div className="bg-card p-8 rounded-lg text-center mb-8">
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
            className="bg-card p-2 rounded cursor-pointer"
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
