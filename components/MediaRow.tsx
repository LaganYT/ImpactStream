import { useRef } from "react";
import { FaChevronLeft, FaChevronRight, FaPlay, FaStar } from "react-icons/fa";

export type MediaRowItem = {
  id: number | string;
  title: string;
  posterUrl: string;
  year?: string;
  rating?: number;
};

type Props = {
  title: string;
  items: MediaRowItem[];
  onItemClick: (item: MediaRowItem) => void;
};

export default function MediaRow({ title, items, onItemClick }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByPage = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.85, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <div className="category media-row">
      <div className="media-row-header">
        <h3>{title}</h3>
      </div>
      <div className="media-row-body">
        <button
          className="row-arrow left"
          onClick={() => scrollByPage(-1)}
          aria-label={`Scroll ${title} backwards`}
        >
          <FaChevronLeft />
        </button>
        <div className="category-scroll" ref={scrollerRef}>
          {items.map((item) => (
            <div key={item.id} className="category-item" onClick={() => onItemClick(item)}>
              <div className="poster-wrap">
                <img src={item.posterUrl} alt={item.title} loading="lazy" />
                <div className="poster-hover">
                  <span className="poster-play">
                    <FaPlay />
                  </span>
                  <div className="poster-hover-meta">
                    {typeof item.rating === "number" && item.rating > 0 ? (
                      <span className="poster-rating">
                        <FaStar size={11} /> {item.rating.toFixed(1)}
                      </span>
                    ) : null}
                    {item.year ? <span>{item.year}</span> : null}
                  </div>
                </div>
              </div>
              <h4>{item.title}</h4>
            </div>
          ))}
        </div>
        <button
          className="row-arrow right"
          onClick={() => scrollByPage(1)}
          aria-label={`Scroll ${title} forwards`}
        >
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}
