import Link from "next/link";
import { ReactNode, useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaStar } from "react-icons/fa";

export type MediaRowItem = {
  id: number | string;
  title: string;
  imageUrl: string;
  rating?: number;
  // Shown in the accent color right after the rating, e.g. "S2.E4".
  highlight?: string;
  details?: (string | undefined)[];
  badge?: string;
};

export type CardShape = "poster" | "backdrop";

export function SectionHeader({
  title,
  subtitle,
  href,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div className="section-heading">
        <h2>
          {href ? (
            <Link href={href} className="section-title-link">
              {title} <FaChevronRight aria-hidden />
            </Link>
          ) : (
            title
          )}
        </h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardMeta({ item }: { item: Pick<MediaRowItem, "rating" | "highlight" | "details"> }) {
  const parts: ReactNode[] = [];
  if (typeof item.rating === "number" && item.rating > 0) {
    parts.push(
      <span key="rating" className="card-rating">
        <FaStar aria-hidden /> {item.rating.toFixed(1)}
      </span>
    );
  }
  if (item.highlight) {
    parts.push(
      <span key="highlight" className="card-highlight">
        {item.highlight}
      </span>
    );
  }
  for (const detail of item.details || []) {
    if (detail) parts.push(<span key={detail}>{detail}</span>);
  }
  return parts.length ? <div className="card-meta">{parts}</div> : null;
}

export function MediaCard({
  item,
  shape,
  onClick,
  corner,
}: {
  item: MediaRowItem;
  shape: CardShape;
  onClick: () => void;
  corner?: ReactNode;
}) {
  return (
    <button type="button" className={`media-card media-card-${shape}`} onClick={onClick}>
      <span className="media-card-art">
        <img src={item.imageUrl} alt="" loading="lazy" />
        {corner}
        {item.badge ? <span className="media-card-badge">{item.badge}</span> : null}
      </span>
      <span className="media-card-title">{item.title}</span>
      <CardMeta item={item} />
    </button>
  );
}

export function SkeletonCards({ shape, count = 7 }: { shape: CardShape; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={`media-card media-card-${shape} skeleton-card`} aria-hidden>
          <span className="media-card-art skeleton" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line short" />
        </span>
      ))}
    </>
  );
}

// Horizontal scroller with edge arrows that only appear when there's more to see.
export function RowScroller({ label, children }: { label: string; children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const updateEdges = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const start = scroller.scrollLeft <= 4;
    const end = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
    setEdges((current) => (current.start === start && current.end === end ? current : { start, end }));
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // Cards arriving after load change the scroll width without resizing the track.
  useEffect(updateEdges, [children]);

  const scrollByPage = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="row-scroller">
      {!edges.start ? (
        <button
          className="row-arrow left"
          onClick={() => scrollByPage(-1)}
          aria-label={`Scroll ${label} backwards`}
        >
          <FaChevronLeft />
        </button>
      ) : null}
      <div className="row-track" ref={scrollerRef} onScroll={updateEdges}>
        {children}
      </div>
      {!edges.end ? (
        <button
          className="row-arrow right"
          onClick={() => scrollByPage(1)}
          aria-label={`Scroll ${label} forwards`}
        >
          <FaChevronRight />
        </button>
      ) : null}
    </div>
  );
}

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  action?: ReactNode;
  // Undefined while loading, which renders skeleton cards.
  items: MediaRowItem[] | undefined;
  shape?: CardShape;
  onItemClick: (item: MediaRowItem) => void;
  renderCorner?: (item: MediaRowItem) => ReactNode;
};

export default function MediaRow({
  title,
  subtitle,
  href,
  action,
  items,
  shape = "backdrop",
  onItemClick,
  renderCorner,
}: Props) {
  if (items && items.length === 0) return null;

  return (
    <section className="media-row">
      <SectionHeader title={title} subtitle={subtitle} href={href} action={action} />
      <RowScroller label={typeof title === "string" ? title : "row"}>
        {items ? (
          items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              shape={shape}
              corner={renderCorner?.(item)}
              onClick={() => onItemClick(item)}
            />
          ))
        ) : (
          <SkeletonCards shape={shape} />
        )}
      </RowScroller>
    </section>
  );
}
