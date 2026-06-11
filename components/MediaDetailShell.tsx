import { ReactNode } from "react";
import { FaStar } from "react-icons/fa";

type MediaDetailShellProps = {
  mediaLabel: string;
  title: string;
  summary: string;
  embedUrl: string;
  rating?: number;
  metaItems?: string[];
  tags?: string[];
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
  rating,
  metaItems = [],
  tags = [],
  actions,
  infoNote,
  recommendations,
  children,
}: MediaDetailShellProps) {
  return (
    <div className="watch-page">
      <div className="watch-player">
        <iframe
          name="framez"
          id="framez"
          src={embedUrl}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          className="movie-iframe"
        />
      </div>

      <div className="watch-info">
        <div className="watch-headline">
          <div className="watch-headline-text">
            <p className="watch-kicker">{mediaLabel}</p>
            <h1 className="watch-title">{title}</h1>
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
          </div>
          {actions ? <div className="watch-actions">{actions}</div> : null}
        </div>

        {infoNote ? <div className="detail-now-playing">{infoNote}</div> : null}

        <p className="watch-overview">{summary}</p>

        {tags.length ? (
          <p className="watch-genres">
            <span>Genres:</span> {tags.join(", ")}
          </p>
        ) : null}
      </div>

      {children ? <div className="watch-episodes">{children}</div> : null}

      {recommendations ? <div className="watch-recs">{recommendations}</div> : null}
    </div>
  );
}
