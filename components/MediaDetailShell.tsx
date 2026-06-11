import { ReactNode, useEffect, useRef } from "react";
import { FaPlay, FaStar } from "react-icons/fa";

type MetaItem = {
  label: string;
  value: string;
};

type MediaDetailShellProps = {
  mediaLabel: string;
  title: string;
  summary: string;
  embedUrl: string;
  posterUrl: string;
  backdropUrl?: string;
  rating?: number;
  metaItems?: string[];
  metadata: MetaItem[];
  tags?: string[];
  cast?: string[];
  isPlaying: boolean;
  onPlay: () => void;
  playLabel?: string;
  actions?: ReactNode;
  infoNote?: ReactNode;
  recommendations?: ReactNode;
  children?: ReactNode;
};

export default function MediaDetailShell({
  mediaLabel,
  title,
  summary,
  embedUrl,
  posterUrl,
  backdropUrl,
  rating,
  metaItems = [],
  metadata,
  tags = [],
  cast = [],
  isPlaying,
  onPlay,
  playLabel = "Play",
  actions,
  infoNote,
  recommendations,
  children,
}: MediaDetailShellProps) {
  const playerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isPlaying && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isPlaying, embedUrl]);

  return (
    <div className="detail-page">
      <section className="detail-hero">
        <div className="detail-hero-backdrop">
          <img src={backdropUrl || posterUrl} alt="" />
        </div>
        <div className="detail-hero-vignette-bottom" />
        <div className="detail-hero-vignette-left" />
        <div className="detail-hero-content">
          <p className="detail-kicker">{mediaLabel}</p>
          <h1 className="detail-title">{title}</h1>
          <div className="detail-meta-row">
            {typeof rating === "number" && rating > 0 ? (
              <span className="meta-rating">
                <FaStar size={12} /> {rating.toFixed(1)}
              </span>
            ) : null}
            {metaItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
            <span className="meta-pill">HD</span>
          </div>
          <p className="detail-hero-overview">{summary}</p>
          <div className="detail-hero-actions">
            <button className="btn-play" onClick={onPlay}>
              <FaPlay /> {playLabel}
            </button>
            {actions}
          </div>
          {tags.length ? (
            <p className="detail-genres">
              <span>Genres:</span> {tags.join(", ")}
            </p>
          ) : null}
        </div>
      </section>

      {isPlaying ? (
        <section className="detail-player-stage" ref={playerRef}>
          <div className="detail-player-frame">
            <iframe
              name="framez"
              id="framez"
              src={embedUrl}
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              className="movie-iframe"
            />
          </div>
          {infoNote ? <div className="detail-now-playing">{infoNote}</div> : null}
        </section>
      ) : null}

      <section className={children ? "detail-body" : "detail-body detail-body-single"}>
        {children ? <div className="detail-body-main">{children}</div> : null}

        <aside className="detail-about">
          <h2>About {title}</h2>
          <div className="detail-about-grid">
            <img src={posterUrl} alt={title} className="detail-about-poster" />
            <div className="detail-about-info">
              {cast.length ? (
                <p>
                  <span>Cast:</span> {cast.join(", ")}
                </p>
              ) : null}
              {tags.length ? (
                <p>
                  <span>Genres:</span> {tags.join(", ")}
                </p>
              ) : null}
              {metadata.map((item) => (
                <p key={`${item.label}-${item.value}`}>
                  <span>{item.label}:</span> {item.value}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {recommendations ? <section className="detail-recs">{recommendations}</section> : null}
    </div>
  );
}
