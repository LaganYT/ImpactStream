import axios from "axios";
import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

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
    setResults(data.results);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-primary">ImpactStream</h1>
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search movies, shows, or anime..."
          className="border p-2 w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={searchContent}
          className="bg-accent text-white p-2 mt-2 w-full"
        >
          Search
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {results.map((item) => (
          <div key={item.id} className="border p-2">
            <h2 className="font-bold">{item.title || item.name}</h2>
            <p>{item.overview}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
