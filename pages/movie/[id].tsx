import { useRouter } from 'next/router';
import axios from 'axios';
import { useEffect, useState } from 'react';

export default function MovieDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<any>(null);

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

  if (!movie) return <div className="text-center text-white">Loading...</div>;

  return (
    <div className="container mx-auto p-4 text-white">
      <h1 className="text-4xl font-bold mb-4 animate-fadeIn">{movie.title}</h1>
      <div className="mb-4">
        <img
          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
          alt={movie.title}
          className="rounded shadow-lg transition-transform duration-300 hover:scale-105"
        />
      </div>
      <p className="text-textSecondary">{movie.overview}</p>
      <div className="mt-4">
        <iframe
          src={`https://vidsrc.me/embed/${id}`}
          width="100%"
          height="500"
          allowFullScreen
          sandbox="allow-same-origin allow-forms allow-scripts allow-modals allow-pointer-lock allow-downloads"
          className="rounded shadow-lg"
        ></iframe>
      </div>
    </div>
  );
}
