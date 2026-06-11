import axios from "axios";
import { useRouter } from "next/router";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FaPlay, FaStar, FaTimes } from "react-icons/fa";
import EpisodeList, { EpisodeInfo } from "./EpisodeList";
import { getMediaType, isAnimeItem, RoutableMediaItem } from "../utils/mediaRouting";

export type TitleRef = {
  id: number;
  mediaType: "movie" | "tv";
  isAnime?: boolean;
};

type TitleModalContextValue = {
  openTitle: (ref: TitleRef) => void;
  closeTitle: () => void;
};

const TitleModalContext = createContext<TitleModalContextValue>({
  openTitle: () => {},
  closeTitle: () => {},
});

export const useTitleModal = () => useContext(TitleModalContext);

type RecommendationItem = RoutableMediaItem & {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
};

type TitleDetails = {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  original_language?: string;
  genres?: { id: number; name: string }[];
  credits?: { cast?: { name: string }[] };
  recommendations?: { results?: RecommendationItem[] };
};

function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function TitleModal({
  titleRef,
  onClose,
  onSwap,
}: {
  titleRef: TitleRef;
  onClose: () => void;
  onSwap: (ref: TitleRef) => void;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setEpisodes([]);
    setSeasonNumber(1);

    const fetchDetails = async () => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/${titleRef.mediaType}/${titleRef.id}`,
          {
            params: {
              api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
              append_to_response: "credits,recommendations",
            },
          }
        );
        if (!cancelled) setDetails(data);
      } catch {
        if (!cancelled) onClose();
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [titleRef.id, titleRef.mediaType, onClose]);

  useEffect(() => {
    if (titleRef.mediaType !== "tv") return;
    let cancelled = false;

    const fetchSeason = async () => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/tv/${titleRef.id}/season/${seasonNumber}`,
          { params: { api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY } }
        );
        if (!cancelled) setEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
      } catch {
        if (!cancelled) setEpisodes([]);
      }
    };

    fetchSeason();
    return () => {
      cancelled = true;
    };
  }, [titleRef.id, titleRef.mediaType, seasonNumber]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const isAnime =
    titleRef.isAnime ??
    Boolean(
      details?.genres?.some((genre) => genre.id === 16) &&
        (details?.original_language === "ja" || titleRef.mediaType === "tv")
    );

  const watchRoute = (extra?: Record<string, string>) => {
    if (isAnime) {
      return {
        pathname: `/anime/${titleRef.id}`,
        query: { type: titleRef.mediaType, ...(extra || {}) },
      };
    }
    return { pathname: `/${titleRef.mediaType}/${titleRef.id}`, query: extra };
  };

  const handlePlay = () => {
    onClose();
    router.push(watchRoute());
  };

  const handleEpisodeSelect = (episode: number) => {
    onClose();
    router.push(watchRoute({ season: String(seasonNumber), episode: String(episode) }));
  };

  const title = details?.title || details?.name || "";
  const year = (details?.release_date || details?.first_air_date || "").slice(0, 4);
  const runtimeLabel = formatRuntime(details?.runtime || details?.episode_run_time?.[0]);
  const backdropUrl = details?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
    : details?.poster_path
    ? `https://image.tmdb.org/t/p/w780${details.poster_path}`
    : null;

  const cast = (details?.credits?.cast || []).slice(0, 5).map((person) => person.name);
  const genres = (details?.genres || []).slice(0, 5).map((genre) => genre.name);

  const recommendations = useMemo(
    () =>
      (details?.recommendations?.results || [])
        .filter((item) => item.backdrop_path || item.poster_path)
        .slice(0, 9),
    [details?.recommendations]
  );

  return (
    <div className="title-modal-overlay" onClick={onClose}>
      <div
        className="title-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Title details"}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="tm-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>

        <div className="tm-backdrop">
          {backdropUrl ? <img src={backdropUrl} alt="" /> : null}
          <div className="tm-backdrop-fade" />
          <div className="tm-hero">
            <h2 className="tm-title">{title}</h2>
            <div className="tm-actions">
              <button className="btn-play" onClick={handlePlay} disabled={!details}>
                <FaPlay /> Play
              </button>
            </div>
          </div>
        </div>

        <div className="tm-content">
          {!details ? (
            <div className="tm-loading">Loading</div>
          ) : (
            <>
              <div className="tm-columns">
                <div className="tm-main">
                  <div className="detail-meta-row">
                    {details.vote_average ? (
                      <span className="meta-rating">
                        <FaStar size={12} /> {details.vote_average.toFixed(1)}
                      </span>
                    ) : null}
                    {year ? <span>{year}</span> : null}
                    {titleRef.mediaType === "tv" && details.number_of_seasons ? (
                      <span>
                        {details.number_of_seasons} Season
                        {details.number_of_seasons > 1 ? "s" : ""}
                      </span>
                    ) : null}
                    {titleRef.mediaType === "movie" && runtimeLabel ? (
                      <span>{runtimeLabel}</span>
                    ) : null}
                    {isAnime ? <span className="meta-pill">ANIME</span> : null}
                    <span className="meta-pill">HD</span>
                  </div>
                  <p className="tm-overview">
                    {details.overview || "No overview is available for this title yet."}
                  </p>
                </div>
                <div className="tm-facts">
                  {cast.length ? (
                    <p>
                      <span>Cast:</span> {cast.join(", ")}
                    </p>
                  ) : null}
                  {genres.length ? (
                    <p>
                      <span>Genres:</span> {genres.join(", ")}
                    </p>
                  ) : null}
                  {titleRef.mediaType === "tv" && details.number_of_episodes ? (
                    <p>
                      <span>Episodes:</span> {details.number_of_episodes}
                    </p>
                  ) : null}
                </div>
              </div>

              {titleRef.mediaType === "tv" ? (
                <EpisodeList
                  episodes={episodes}
                  seasonCount={details.number_of_seasons || 1}
                  season={seasonNumber}
                  onSeasonChange={setSeasonNumber}
                  onEpisodeSelect={handleEpisodeSelect}
                />
              ) : null}

              {recommendations.length ? (
                <div className="tm-recs">
                  <h3>More Like This</h3>
                  <div className="tm-recs-grid">
                    {recommendations.map((item) => {
                      const recTitle = item.title || item.name || "Untitled";
                      const recYear = (item.release_date || item.first_air_date || "").slice(0, 4);
                      const imageUrl = item.backdrop_path
                        ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
                        : `https://image.tmdb.org/t/p/w500${item.poster_path}`;
                      return (
                        <div
                          key={item.id}
                          className="tm-rec-card"
                          onClick={() =>
                            onSwap({
                              id: item.id,
                              mediaType: getMediaType(item),
                              isAnime: isAnimeItem(item),
                            })
                          }
                        >
                          <img src={imageUrl} alt={recTitle} loading="lazy" />
                          <div className="tm-rec-body">
                            <div className="tm-rec-title-row">
                              <h4>{recTitle}</h4>
                              {recYear ? <span>{recYear}</span> : null}
                            </div>
                            {item.overview ? <p>{item.overview}</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TitleModalProvider({ children }: { children: ReactNode }) {
  const [titleRef, setTitleRef] = useState<TitleRef | null>(null);

  const openTitle = useCallback((ref: TitleRef) => setTitleRef(ref), []);
  const closeTitle = useCallback(() => setTitleRef(null), []);

  const value = useMemo(() => ({ openTitle, closeTitle }), [openTitle, closeTitle]);

  return (
    <TitleModalContext.Provider value={value}>
      {children}
      {titleRef ? (
        <TitleModal titleRef={titleRef} onClose={closeTitle} onSwap={openTitle} />
      ) : null}
    </TitleModalContext.Provider>
  );
}
