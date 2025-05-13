import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useState } from "react";

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
  { name: "AutoEmbed.cc", url: "https://player.autoembed.cc/embed/movie/" },
  { name: "VidSrc.to", url: "https://vidsrc.to/embed/movie/" },
];

export default function MovieDetails() {
  const router = useRouter();
  const { id, api } = router.query;
  const [movie, setMovie] = useState<any>(null);
  const [selectedApi, setSelectedApi] = useState(
    STREAM_APIS.find((a) => a.url === api) || STREAM_APIS[0]
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
      const found = STREAM_APIS.find((a) => a.url === api);
      if (found) setSelectedApi(found);
    }
  }, [api]);

  if (!movie) return <div className="loading">Loading...</div>;

  return (
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe
          src={`${selectedApi.url}${id}`}
          allowFullScreen
          className="movie-iframe"
        ></iframe>
      </div>
      <div className="api-selector">
        <label htmlFor="api-select">Streaming API:</label>
        <select
          id="api-select"
          value={selectedApi.url}
          onChange={(e) =>
            setSelectedApi(
              STREAM_APIS.find((api) => api.url === e.target.value)
            )
          }
        >
          {STREAM_APIS.map((api) => (
            <option key={api.url} value={api.url}>
              {api.name}
            </option>
          ))}
        </select>
      </div>
      <div className="movie-card">
        <div className="movie-header">
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="movie-poster"
          />
          <div className="movie-info">
            <h1 className="movie-title">{movie.title}</h1>
            <p className="movie-description">{movie.overview}</p>
            <div className="movie-metadata">
              <span>Release: {movie.release_date}</span>
              <span>Rating: {movie.vote_average}</span>
              <span>Runtime: {movie.runtime} min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
