import { FaTimes } from "react-icons/fa";
import { MediaCard } from "./MediaRow";

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
        <div key={item.key} className="grid-cell">
          <MediaCard
            shape="poster"
            item={{
              id: item.key,
              title: item.title,
              imageUrl: item.posterUrl,
              rating: item.rating,
              details: [item.year, item.label],
            }}
            onClick={() => onSelect(item)}
          />
          {onRemove ? (
            <button
              className="icon-button cw-remove-btn"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item.title}`}
              title="Remove"
            >
              <FaTimes />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
