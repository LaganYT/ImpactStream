import { useEffect, useState } from "react";
import { FaInfoCircle, FaPlay, FaStar } from "react-icons/fa";

export type BillboardItem = {
  id: string;
  title: string;
  backdropUrl: string;
  overview?: string;
  rating?: number;
  year?: string;
  typeLabel?: string;
};

type Props = {
  items: BillboardItem[];
  getKicker?: (item: BillboardItem, index: number) => string;
  onPlay: (item: BillboardItem) => void;
  onInfo: (item: BillboardItem) => void;
  intervalMs?: number;
};

export default function Billboard({
  items,
  getKicker,
  onPlay,
  onInfo,
  intervalMs = 8000,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    if (items.length < 2) return;
    const timer = setInterval(
      () => setActiveIndex((current) => (current + 1) % items.length),
      intervalMs
    );
    return () => clearInterval(timer);
  }, [items.length, intervalMs]);

  if (items.length === 0) return null;

  const index = activeIndex % items.length;
  const spotlight = items[index];

  return (
    <section className="billboard">
      <div className="billboard-backdrop">
        <img key={spotlight.id} src={spotlight.backdropUrl} alt={spotlight.title} />
      </div>
      <div className="billboard-vignette-bottom" />
      <div className="billboard-vignette-left" />
      <div className="billboard-content">
        {getKicker ? (
          <p className="billboard-kicker">{getKicker(spotlight, index)}</p>
        ) : null}
        <h1 className="billboard-title">{spotlight.title}</h1>
        <div className="billboard-meta">
          {typeof spotlight.rating === "number" && spotlight.rating > 0 ? (
            <span className="meta-rating">
              <FaStar size={12} /> {spotlight.rating.toFixed(1)}
            </span>
          ) : null}
          {spotlight.year ? <span>{spotlight.year}</span> : null}
          {spotlight.typeLabel ? (
            <span className="meta-pill">{spotlight.typeLabel}</span>
          ) : null}
          <span className="meta-pill">HD</span>
        </div>
        {spotlight.overview ? (
          <p className="billboard-overview">{spotlight.overview}</p>
        ) : null}
        <div className="billboard-actions">
          <button className="btn-play" onClick={() => onPlay(spotlight)}>
            <FaPlay /> Play
          </button>
          <button className="btn-more-info" onClick={() => onInfo(spotlight)}>
            <FaInfoCircle /> More Info
          </button>
        </div>
      </div>
      <div className="billboard-dots">
        {items.map((item, dotIndex) => (
          <button
            key={item.id}
            className={dotIndex === index ? "billboard-dot active" : "billboard-dot"}
            onClick={() => setActiveIndex(dotIndex)}
            aria-label={`Show ${item.title}`}
          />
        ))}
      </div>
    </section>
  );
}
