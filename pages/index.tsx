import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Header from "../components/Header";
import Footer from "../components/Footer";

const STREAM_APIS = [
  { name: "VidSrc.me", url: "https://vidsrc.me/embed/" },
  { name: "VidSrc.cc", url: "https://vidsrc.cc/embed/" },
  { name: "Embed.su", url: "https://embed.su/embed/" },
  { name: "VidLink.pro", url: "https://vidlink.pro/embed/" },
  { name: "VidSrc.icu", url: "https://vidsrc.icu/embed/" },
  { name: "AutoEmbed.cc", url: "https://autoembed.cc/movie/" },
  { name: "VidSrc.to", url: "https://vidsrc.to/embed/" },
];

export default function Home() {
  const [trending, setTrending] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedApi, setSelectedApi] = useState(STREAM_APIS[0]);
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
    if (!query.trim()) return;
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

  const handleCardClick = (item: any) => {
    router.push({
      pathname: `/movie/${item.id}`,
      query: { api: selectedApi.url },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-darkBackground text-white">
      <Header query={query} setQuery={setQuery} onSearch={searchContent} />
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-card dark:bg-darkCard p-8 rounded-lg text-center mb-8 mt-4 animate-fadeIn shadow-lg">
          <h1 className="text-4xl font-bold text-accent mb-4">
            Welcome to ImpactStream
          </h1>
          <p className="text-textSecondary dark:text-darkTextSecondary">
            Discover and stream your favorite movies, TV shows, and anime all in one place.
          </p>
        </div>

        {/* API Selector */}
        <div className="flex items-center mb-6">
          <label className="mr-2 text-textSecondary dark:text-darkTextSecondary font-medium">
            Streaming API:
          </label>
          <select
            className="bg-input dark:bg-darkInput text-white rounded px-3 py-2"
            value={selectedApi.url}
            onChange={e => setSelectedApi(STREAM_APIS.find(api => api.url === e.target.value))}
          >
            {STREAM_APIS.map(api => (
              <option key={api.url} value={api.url}>{api.name}</option>
            ))}
          </select>
        </div>

        {/* Trending/Search Results Section */}
        <h2 className="text-2xl font-bold mb-4">Trending Now</h2>
        <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {trending.map((item: any) => (
            <div
              key={item.id}
              className="bg-card dark:bg-darkCard p-2 rounded-lg cursor-pointer shadow-lg transition-transform duration-300 hover:scale-105 flex flex-col items-center group"
              onClick={() => handleCardClick(item)}
            >
              <div className="relative w-full aspect-[2/3] overflow-hidden rounded">
                <img
                  src={item.poster_path
                    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                    : "/no-image.svg"}
                  alt={item.title || item.name}
                  className="rounded w-full h-full object-cover group-hover:opacity-90 transition"
                />
                {item.vote_average && (
                  <span className="absolute top-2 right-2 bg-accent text-black text-xs px-2 py-1 rounded font-bold shadow">
                    {item.vote_average.toFixed(1)}
                  </span>
                )}
              </div>
              <h3 className="text-base mt-2 text-textPrimary dark:text-darkTextPrimary font-semibold text-center line-clamp-2">
                {item.title || item.name}
              </h3>
              <span className="text-xs text-textSecondary dark:text-darkTextSecondary mt-1">
                {item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ""}
              </span>
              <button
                className="mt-2 bg-accent text-black px-3 py-1 rounded hover:bg-accentHover transition text-sm font-medium"
                onClick={e => {
                  e.stopPropagation();
                  handleCardClick(item);
                }}
              >
                Watch
              </button>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
