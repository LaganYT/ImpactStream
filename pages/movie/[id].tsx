import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useState } from "react";

const STREAM_APIS = [
  { name: "VidSrc.me", url: "ttps://vidsrcprxy.vercel.app/api/player?url=https://vidsrc-embed.ru/embed/tv/${id}/${seasonNumber}/${episodeNumber}?ds_lang=en" },
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

  useEffect(() => {
    if (api) {
      const found = STREAM_APIS.find((a) => a.url === api);
      if (found) setSelectedApi(found);
    }
  }, [api]);

  if (!movie) return <div className="loading">Loading...</div>;

  const runtime = movie.runtime || movie.episode_run_time?.[0];
  const releaseDate = movie.release_date || movie.first_air_date;

  return (
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe
          name="framez"
          id="framez"
          src={`ttps://vidsrcprxy.vercel.app/api/player?url=https://vidsrc-embed.ru/embed/movie/${id}?ds_lang=en`}
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


