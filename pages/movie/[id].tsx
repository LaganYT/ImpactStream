import { useRouter } from 'next/router';
import axios from 'axios';
import { useEffect, useState } from 'react';

const STREAM_APIS = [
  { name: "VidSrc.me", url: "https://vidsrc.me/embed/movie/" },
  { name: "Vidsrc.in", url: "https://vidsrc.in/embed/movie/" },
  { name: "Vidsrc.net", url: "https://vidsrc.net/embed/movie/" },
  { name: "Vidsrc.pm", url: "https://vidsrc.pm/embed/movie/" },
  { name: "VidSrc.xyz", url: "https://vidsrc.xyz/embed/movie/" },
  { name: "VidSrc.cc", url: "https://vidsrc.cc/v3/embed/movie/" },
  { name: "Embed.su", url: "https://embed.su/embed/movie/" },
  { name: "VidLink.pro", url: "https://vidlink.pro/movie/" },
  { name: "VidSrc.icu", url: "https://vidsrc.icu/embed/movie/" },
  { name: "AutoEmbed.cc", url: "https://autoembed.cc/movie/" },
  { name: "VidSrc.to", url: "https://vidsrc.to/embed/movie/" },
];

export default function MovieDetails() {
  const router = useRouter();
  const { id, api } = router.query;
  const [movie, setMovie] = useState<any>(null);
  const [selectedApi, setSelectedApi] = useState(
    STREAM_APIS.find(a => a.url === api) || STREAM_APIS[0]
  );

  useEffect(() => {
    if (!id) return;

    const fetchMovie = async () => {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/movie/${id}`,
        {
          params: {
            api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
          },
        }
      );
      setMovie(data);
    };

    fetchMovie();
  }, [id]);

  useEffect(() => {
    if (api) {
      const found = STREAM_APIS.find(a => a.url === api);
      if (found) setSelectedApi(found);
    }
  }, [api]);

  if (!movie) return <div className="text-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-background dark:bg-darkBackground text-white flex flex-col items-center py-8 px-2">
      <div className="w-full max-w-4xl bg-card dark:bg-darkCard rounded-lg shadow-lg p-6 animate-fadeIn">
        <div className="flex flex-col md:flex-row gap-6">
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="rounded shadow-lg w-48 h-auto self-center"
          />
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2 text-accent">{movie.title}</h1>
            <p className="text-textSecondary dark:text-darkTextSecondary mb-4">{movie.overview}</p>
            <div className="flex flex-wrap gap-4 text-sm mb-4">
              <span>Release: {movie.release_date}</span>
              <span>Rating: {movie.vote_average}</span>
              <span>Runtime: {movie.runtime} min</span>
            </div>
            <div className="mb-2">
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
          </div>
        </div>
        <div className="mt-8">
          <iframe
            src={`${selectedApi.url}${id}`}
            width="100%"
            height="500"
            allowFullScreen
            className="rounded shadow-lg w-full"
          ></iframe>
        </div>
      </div>
    </div>
  );
}
