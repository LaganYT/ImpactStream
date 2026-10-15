import { useCallback, useEffect, useState } from "react";
import { FaFilm, FaInfoCircle, FaPlay, FaStar } from "react-icons/fa";
import TrailerDialog from "./TrailerDialog";

export type BillboardItem = {
  id: string;
  title: string;
  backdropUrl: string;
  logoUrl?: string | null;
  overview?: string;
  rating?: number;
  year?: string;
  typeLabel?: string;
  genres?: string[];
  rankLabel?: string;
  trailerKey?: string | null;
};

type Props = {
  items: BillboardItem[];
  onPlay: (item: BillboardItem) => void;
  onInfo: (item: BillboardItem) => void;
  intervalMs?: number;
};

export default function Billboard({ items, onPlay, onInfo, intervalMs = 9000 }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trailerItem, setTrailerItem] = useState<BillboardItem | null>(null);
  const index = items.length ? activeIndex % items.length : 0;

  // One timer per slide keeps auto-advance in step with the progress bar, and
  // picking a slide or closing a trailer restarts it.
  useEffect(() => {
    if (items.length < 2 || trailerItem) return;
    const timer = window.setTimeout(() => setActiveIndex(index + 1), intervalMs);
    return () => window.clearTimeout(timer);
  }, [index, items.length, intervalMs, trailerItem]);

  const closeTrailer = useCallback(() => setTrailerItem(null), []);

  if (items.length === 0) return null;
  const spotlight = items[index];
  const meta = [spotlight.year, spotlight.typeLabel, ...(spotlight.genres || [])].filter(Boolean);

  return (
    <section className="billboard" aria-roledescription="carousel" aria-label="Featured titles">
      <div className="billboard-backdrop">
        {items.map((item, itemIndex) => (
          <img
            key={item.id}
            src={item.backdropUrl}
            alt=""
            className={itemIndex === index ? "active" : undefined}
          />
        ))}
      </div>
      <div className="billboard-vignette" />

      <div className="billboard-content" key={spotlight.id}>
        {spotlight.logoUrl ? (
          <h1 className="billboard-logo">
            <img src={spotlight.logoUrl} alt={spotlight.title} />
          </h1>
        ) : (
          <h1 className="billboard-title">{spotlight.title}</h1>
        )}
        <div className="billboard-meta">
          {typeof spotlight.rating === "number" && spotlight.rating > 0 ? (
            <span className="card-rating">
              <FaStar aria-hidden /> {spotlight.rating.toFixed(1)}
            </span>
          ) : null}
          {meta.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
        {spotlight.overview ? <p className="billboard-overview">{spotlight.overview}</p> : null}
        <div className="billboard-actions">
          <button className="btn-play" onClick={() => onPlay(spotlight)}>
            <FaPlay /> Play
          </button>
          <button className="btn-more-info" onClick={() => onInfo(spotlight)}>
            <FaInfoCircle /> More info
          </button>
          {spotlight.trailerKey ? (
            <button className="btn-more-info" onClick={() => setTrailerItem(spotlight)}>
              <FaFilm /> Trailer
            </button>
          ) : null}
        </div>
      </div>

      <div className="billboard-side">
        {spotlight.rankLabel ? <span className="rank-pill">{spotlight.rankLabel}</span> : null}
        {items.length > 1 ? (
          <div className="billboard-progress">
            {items.map((item, itemIndex) => (
              <button
                key={item.id}
                className={itemIndex === index ? "active" : itemIndex < index ? "done" : undefined}
                onClick={() => setActiveIndex(itemIndex)}
                aria-label={`Show ${item.title}`}
                aria-current={itemIndex === index}
              >
                <span
                  key={`${index}-${Boolean(trailerItem)}`}
                  style={{ animationDuration: `${intervalMs}ms` }}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {trailerItem?.trailerKey ? (
        <TrailerDialog
          videoKey={trailerItem.trailerKey}
          title={trailerItem.title}
          onClose={closeTrailer}
        />
      ) : null}
    </section>
  );
}
