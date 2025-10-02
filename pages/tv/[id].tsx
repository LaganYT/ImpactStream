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
  const [seasonNumber, setSeasonNumber] = useState<number>(1);
  const [episodeNumber, setEpisodeNumber] = useState<number>(1);
  const [episodesCount, setEpisodesCount] = useState<number>(0);

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
    // When tvShow is loaded, initialize season and episode selectors
    if (!tvShow || !id) return;
    const initialSeason = 1;
    setSeasonNumber(initialSeason);
    // Fetch episode count for initial season
    const fetchSeason = async (season: number) => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${season}`,
          { params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY } }
        );
        const count = Array.isArray(data.episodes) ? data.episodes.length : 0;
        setEpisodesCount(count);
        setEpisodeNumber(count > 0 ? 1 : 0);
      } catch (_) {
        setEpisodesCount(0);
        setEpisodeNumber(0);
      }
    };
    fetchSeason(initialSeason);
  }, [tvShow, id]);

  const handleSeasonChange = async (value: number) => {
    setSeasonNumber(value);
    try {
      const { data } = await axios.get(
        `https://api.themoviedb.org/3/tv/${id}/season/${value}`,
        { params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY } }
      );
      const count = Array.isArray(data.episodes) ? data.episodes.length : 0;
      setEpisodesCount(count);
      setEpisodeNumber(count > 0 ? 1 : 0);
    } catch (_) {
      setEpisodesCount(0);
      setEpisodeNumber(0);
    }
  };

  useEffect(() => {
    const iframe = document.getElementById("framez") as HTMLIFrameElement;
    if (iframe && id) {
      const newSrc = `https://vidsrc.net/embed/tv/${id}/${seasonNumber}-${episodeNumber}`;
      if (
        iframe.sandbox &&
        iframe.sandbox.contains("allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation")
      ) {
        iframe.removeAttribute("sandbox");
      }
      iframe.src = newSrc; // Update iframe with new season/episode
      iframe.sandbox = "allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation";
    }
  }, [selectedApi, id, seasonNumber, episodeNumber]);

  if (!tvShow) return <div className="loading">Loading...</div>;

  return (
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe
          name="framez"
          id="framez"
          //src={`${selectedApi.url}${id}/${seasonNumber}-${episodeNumber}`}
          src={`https://vidsrc.net/embed/tv/${id}/${seasonNumber}-${episodeNumber}`}
          allowFullScreen
          className="movie-iframe"
        ></iframe>
      </div>
      <div className="api-selector">
        {/*<label htmlFor="api-select">Streaming API:</label>
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
        </select>*/}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
          <label htmlFor="season-select">Season:</label>
          <select
            id="season-select"
            value={seasonNumber}
            onChange={(e) => handleSeasonChange(Number(e.target.value))}
          >
            {tvShow && Array.from({ length: tvShow.number_of_seasons || 0 }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label htmlFor="episode-select">Episode:</label>
          <select
            id="episode-select"
            value={episodeNumber}
            onChange={(e) => setEpisodeNumber(Number(e.target.value))}
            disabled={episodesCount === 0}
          >
            {Array.from({ length: episodesCount || 0 }, (_, i) => i + 1).map((ep) => (
              <option key={ep} value={ep}>{ep}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            const popup = window.open(
              "",
              "downloadPopup",
              "width=1000,height=700,menubar=no,toolbar=no,status=no,scrollbars=yes"
            );
            if (popup) {
              const s = seasonNumber;
              const e = episodeNumber;
              const dlUrl = `https://dl.vidsrc.vip/tv/${id}/${s}/${e}`;
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
