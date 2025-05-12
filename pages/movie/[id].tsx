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

  if (!movie) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{movie.title}</h1>
      <div className="mb-4">
        <img
          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
          alt={movie.title}
          className="rounded"
        />
      </div>
      <p>{movie.overview}</p>
      <div className="mt-4">
        <iframe
          src={`https://vidsrc.me/embed/${id}`}
          width="100%"
          height="500"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
}
