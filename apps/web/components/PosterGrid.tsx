import { FaTimes } from "react-icons/fa";

export type PosterGridItem = {
  key: string;
  title: string;
  posterUrl: string;
  label?: string;
  year?: string;
  rating?: number;
};

type Props = {
  items: PosterGridItem[];
  onSelect: (item: PosterGridItem) => void;
  onRemove?: (item: PosterGridItem) => void;
};

export default function PosterGrid({ items, onSelect, onRemove }: Props) {
  return (
    <div className="discover-grid">
      {items.map((item) => (
        <article key={item.key} className="discover-card" onClick={() => onSelect(item)}>
          <div className="poster-grid-image">
            <img src={item.posterUrl} alt={item.title} loading="lazy" />
            {onRemove ? (
              <button
                className="cw-remove-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(item);
                }}
                aria-label={`Remove ${item.title}`}
                title="Remove"
              >
                <FaTimes />
              </button>
            ) : null}
          </div>
          <div className="discover-card-content">
            {item.label ? <span className="discover-pill">{item.label}</span> : null}
            <h3>{item.title}</h3>
            <p>
              {item.year || "N/A"}
              {typeof item.rating === "number" && item.rating > 0
                ? ` • ⭐ ${item.rating.toFixed(1)}`
                : ""}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
