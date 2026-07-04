import axios from "axios";
import { useRouter } from "next/router";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FaDownload, FaPlay, FaStar, FaTimes, FaVolumeMute, FaVolumeUp } from "react-icons/fa";
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

type VideoItem = {
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
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
  imdb_id?: string;
  genres?: { id: number; name: string }[];
  external_ids?: { imdb_id?: string };
  credits?: { cast?: { name: string }[] };
  recommendations?: { results?: RecommendationItem[] };
  videos?: { results?: VideoItem[] };
};

function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function buildDownloadUrl(
  mediaType: "movie" | "tv",
  tmdbId: number,
  season?: number,
  episode?: number
) {
  if (mediaType === "tv") {
    return `https://1embed.cc/download/tv/${tmdbId}/${season || 1}/${episode || 1}`;
  }
  return `https://1embed.cc/download/movie/${tmdbId}`;
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
  const trailerFrameRef = useRef<HTMLIFrameElement>(null);
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [isTrailerMuted, setIsTrailerMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setEpisodes([]);
    setSeasonNumber(1);
    setIsTrailerMuted(true);

    const fetchDetails = async () => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/${titleRef.mediaType}/${titleRef.id}`,
          {
            params: {
              api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
              append_to_response: "credits,recommendations,videos,external_ids",
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

  const trailerKey = useMemo(() => {
    const videos = (details?.videos?.results || []).filter(
      (video) => video.site === "YouTube" && video.key
    );
    const pick =
      videos.find((video) => video.type === "Trailer" && video.official) ||
      videos.find((video) => video.type === "Trailer") ||
      videos.find((video) => video.type === "Teaser");
    return pick?.key || null;
  }, [details?.videos]);

  const toggleTrailerMute = () => {
    const frame = trailerFrameRef.current;
    if (!frame?.contentWindow) return;
    const func = isTrailerMuted ? "unMute" : "mute";
    frame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
    setIsTrailerMuted(!isTrailerMuted);
  };

  const handleDownload = (episode?: number) => {
    window.open(
      buildDownloadUrl(titleRef.mediaType, titleRef.id, seasonNumber, episode),
      "_blank",
      "noreferrer"
    );
  };

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
    <>
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
            {trailerKey ? (
              <>
                <div className="tm-trailer">
                  <iframe
                    ref={trailerFrameRef}
                    src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&loop=1&playlist=${trailerKey}&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1`}
                    title={`${title} trailer`}
                    allow="autoplay; encrypted-media"
                  />
                </div>
                <button
                  className="tm-mute"
                  onClick={toggleTrailerMute}
                  aria-label={isTrailerMuted ? "Unmute trailer" : "Mute trailer"}
                >
                  {isTrailerMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
              </>
            ) : (
              <>
                {backdropUrl ? <img src={backdropUrl} alt="" /> : null}
                <div className="tm-backdrop-fade" />
              </>
            )}
            <div className="tm-hero">
              <h2 className="tm-title">{title}</h2>
              <div className="tm-actions">
                <button className="btn-play" onClick={handlePlay} disabled={!details}>
                  <FaPlay /> Play
                </button>
                {details && titleRef.mediaType === "movie" ? (
                  <button
                    className="btn-more-info"
                    onClick={() => handleDownload()}
                  >
                    <FaDownload />
                    Download
                  </button>
                ) : null}
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
                    onEpisodeDownload={(episode) => handleDownload(episode)}
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

    </>
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
