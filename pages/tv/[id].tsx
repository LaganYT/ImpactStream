import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useState } from "react";

const STREAM_APIS = [
  { name: "VidSrc.me", url: "https://vidsrc.me/embed/tv/" },
  { name: "Vidsrc.in", url: "https://vidsrc.in/embed/tv/" },
  { name: "Vidsrc.net", url: "https://vidsrc.net/embed/tv/" },
  { name: "Vidsrc.pm", url: "https://vidsrc.pm/embed/tv/" },
  { name: "VidSrc.xyz", url: "https://vidsrc.xyz/embed/tv/" },
  { name: "VidSrc.cc", url: "https://vidsrc.cc/v3/embed/tv/" },
  { name: "Embed.su", url: "https://embed.su/embed/tv/" },
  { name: "VidSrc.icu", url: "https://vidsrc.icu/embed/tv/" },
  { name: "AutoEmbed.cc", url: "https://player.autoembed.cc/embed/tv/" },
  { name: "VidSrc.to", url: "https://vidsrc.to/embed/tv/" },
];

export default function TVDetails() {
  const router = useRouter();
  const { id, api } = router.query;
  const [tvShow, setTVShow] = useState<any>(null);
  const [selectedApi, setSelectedApi] = useState(
    STREAM_APIS.find((a) => a.url === api) || STREAM_APIS[0]
  );

  useEffect(() => {
    if (!id) return;

    const fetchTVShow = async () => {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}`,
        {
          params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
        }
      );
      setTVShow(data);
    };

    fetchTVShow();
  }, [id]);

  useEffect(() => {
    if (api) {
      const found = STREAM_APIS.find((a) => a.url === api);
      if (found) setSelectedApi(found);
    }
  }, [api]);

  useEffect(() => {
    const iframe = document.getElementById("framez") as HTMLIFrameElement;
    if (iframe) {
      const currentSrc = iframe.src;
      if (
        iframe.sandbox &&
        iframe.sandbox.contains("allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation")
      ) {
        iframe.removeAttribute("sandbox");
      }
      iframe.src = currentSrc; // Reload iframe
      iframe.sandbox = "allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation";
    }
  }, [selectedApi, id]);

  if (!tvShow) return <div className="loading">Loading...</div>;

  return (
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe
          name="framez"
          id="framez"
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
            src={`https://image.tmdb.org/t/p/w500${tvShow.poster_path}`}
            alt={tvShow.name}
            className="movie-poster"
          />
          <div className="movie-info">
            <h1 className="movie-title">{tvShow.name}</h1>
            <p className="movie-description">{tvShow.overview}</p>
            <div className="movie-metadata">
              <span>First Air Date: {tvShow.first_air_date}</span>
              <span>Rating: {tvShow.vote_average}</span>
              <span>Episodes: {tvShow.number_of_episodes}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
