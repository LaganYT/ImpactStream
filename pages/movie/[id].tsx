import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useState } from "react";

export default function MovieDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [movie, setMovie] = useState<any>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      const endpoint = "movie"; // Fixed to always use "movie"
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/${endpoint}/${id}`,
        {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        }
      );
      setMovie(data);
    };

    fetchDetails();
  }, [id]);

  if (!movie) return <div className="loading">Loading...</div>;

  const runtime = movie.runtime || movie.episode_run_time?.[0];
  const releaseDate = movie.release_date || movie.first_air_date;

  return (
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe
          name="framez"
          id="framez"
          src={`https://player.videasy.net/movie/${id}?color=e50914&nextEpisode=true&episodeSelector=true`}
          allowFullScreen
          className="movie-iframe"
        ></iframe>
      </div>
      <div className="api-selector">
        <button
          onClick={() => {
            const popup = window.open(
              "",
              "downloadPopup",
              "width=1000,height=700,menubar=no,toolbar=no,status=no,scrollbars=yes"
            );
            if (popup) {
              const dlUrl = `https://dl.vidsrc.vip/movie/${id}`;
              popup.document.write(
                `<!DOCTYPE html><html><head><title>Download</title><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" /><style>html,body{margin:0;height:100%;background:#000} .frame{border:0;width:100%;height:100%;}</style></head><body><iframe class=\"frame\" src=\"${dlUrl}\" allowfullscreen></iframe></body></html>`
              );
              popup.document.close();
            }
          }}
          style={{ marginLeft: 12 }}
        >
          Download
        </button>
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
              <span>Release: {releaseDate}</span>
              <span>Rating: {movie.vote_average}</span>
              <span>Runtime: {runtime} min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}






