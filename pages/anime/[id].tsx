import { useRouter } from "next/router";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";

type AnimeType = "movie" | "tv";

type AnimeDetails = {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
};

export default function AnimeDetailsPage() {
  const router = useRouter();
  const { id, type } = router.query;

  const animeType: AnimeType = type === "movie" ? "movie" : "tv";

  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState<number>(1);
  const [episodeNumber, setEpisodeNumber] = useState<number>(1);
  const [episodesCount, setEpisodesCount] = useState<number>(0);

  useEffect(() => {
    if (!id) return;

    const fetchDetails = async () => {
      const { data } = await axios.get(`https://api.themoviedb.org/3/${animeType}/${id}`, {
        params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
      });
      setAnime(data);
    };

    fetchDetails();
  }, [id, animeType]);

  useEffect(() => {
    if (!id || animeType !== "tv") return;

    const fetchSeason = async (season: number) => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${season}`,
          { params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY } }
        );
        const count = Array.isArray(data.episodes) ? data.episodes.length : 0;
        setEpisodesCount(count);
        setEpisodeNumber(count > 0 ? 1 : 0);
      } catch {
        setEpisodesCount(0);
        setEpisodeNumber(0);
      }
    };

    fetchSeason(1);
  }, [id, animeType]);

  const handleSeasonChange = async (value: number) => {
    if (!id) return;

    setSeasonNumber(value);
    try {
      const { data } = await axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${value}`, {
        params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY },
      });
      const count = Array.isArray(data.episodes) ? data.episodes.length : 0;
      setEpisodesCount(count);
      setEpisodeNumber(count > 0 ? 1 : 0);
    } catch {
      setEpisodesCount(0);
      setEpisodeNumber(0);
    }
  };

  const streamUrl = useMemo(() => {
    if (!id) return "";
    if (animeType === "movie") {
      return `https://player.videasy.net/movie/${id}?color=e50914&nextEpisode=true&episodeSelector=true`;
    }

    return `https://player.videasy.net/tv/${id}/${seasonNumber}/${episodeNumber}?color=e50914&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true`;
  }, [id, animeType, seasonNumber, episodeNumber]);

  if (!anime) return <div className="loading">Loading...</div>;

  const title = anime.title || anime.name || "Untitled";
  const releaseDate = anime.release_date || anime.first_air_date;
  const runtime = anime.runtime || anime.episode_run_time?.[0];

  return (
    <div className="movie-details-container">
      <div className="movie-player">
        <iframe name="framez" id="framez" src={streamUrl} allowFullScreen className="movie-iframe"></iframe>
      </div>

      {animeType === "tv" ? (
        <div className="tv-selector-container">
          <div className="tv-selector-group">
            <label htmlFor="anime-season-select" className="tv-selector-label">Season:</label>
            <select
              id="anime-season-select"
              className="tv-selector-select"
              value={seasonNumber}
              onChange={(e) => handleSeasonChange(Number(e.target.value))}
            >
              {Array.from({ length: anime.number_of_seasons || 0 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>Season {s}</option>
              ))}
            </select>
          </div>

          <div className="tv-selector-group">
            <label htmlFor="anime-episode-select" className="tv-selector-label">Episode:</label>
            <select
              id="anime-episode-select"
              className="tv-selector-select"
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(Number(e.target.value))}
              disabled={episodesCount === 0}
            >
              {Array.from({ length: episodesCount || 0 }, (_, i) => i + 1).map((ep) => (
                <option key={ep} value={ep}>Episode {ep}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="movie-card">
        <div className="movie-header">
          <img
            src={`https://image.tmdb.org/t/p/w500${anime.poster_path}`}
            alt={title}
            className="movie-poster"
          />
          <div className="movie-info">
            <h1 className="movie-title">{title}</h1>
            <p className="movie-description">{anime.overview}</p>
            <div className="movie-metadata">
              <span>Release: {releaseDate}</span>
              <span>Rating: {anime.vote_average}</span>
              {animeType === "movie" ? (
                <span>Runtime: {runtime} min</span>
              ) : (
                <span>Episodes: {anime.number_of_episodes}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
