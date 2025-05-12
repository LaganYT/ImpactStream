import axios from 'axios';
import { useEffect, useState } from 'react';

export default function Home() {
  const [trending, setTrending] = useState([]);

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
      <h1 className="text-2xl font-bold mb-4">Trending Movies & TV Shows</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {trending.map((item: any) => (
          <div key={item.id} className="bg-gray-800 p-2 rounded">
            <img
              src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
              alt={item.title || item.name}
              className="rounded"
            />
            <h2 className="text-sm mt-2">
              {item.title || item.name}
            </h2>
          </div>
        ))}
      </div>
    </div>
  );
}
