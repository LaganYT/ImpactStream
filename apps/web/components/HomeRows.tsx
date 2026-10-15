import Link from "next/link";
import { CSSProperties, ReactNode, useEffect, useState } from "react";
import MediaRow, { CardShape, MediaRowItem, RowScroller, SectionHeader } from "./MediaRow";
import { useTitleModal } from "./TitleModal";
import { listContinueWatching, ContinueWatchingEntry } from "../utils/continueWatching";
import {
  mediaItemKey,
  normalizeListItems,
  TmdbListItem,
  TmdbPage,
  toRowItem,
  toTitleRef,
} from "../utils/mediaItems";
import { TMDB_IMAGE_BASE_URL, useTmdb } from "../utils/tmdbClient";

const ROW_LIMIT = 18;

// Turns TMDB list items into row cards and opens the title modal on click.
function ListRow({
  items,
  shape,
  badges,
  ...header
}: {
  items: TmdbListItem[] | undefined;
  shape: CardShape;
  badges?: boolean;
  title: ReactNode;
  subtitle?: string;
  href?: string;
  action?: ReactNode;
}) {
  const { openTitle } = useTitleModal();
  const visible = items
    ?.filter((item) => (shape === "backdrop" ? item.backdrop_path : item.poster_path))
    .slice(0, ROW_LIMIT);

  const handleClick = (row: MediaRowItem) => {
    const match = visible?.find((item) => mediaItemKey(item) === row.id);
    if (match) openTitle(toTitleRef(match));
  };

  return (
    <MediaRow
      {...header}
      shape={shape}
      items={visible?.map((item) => toRowItem(item, shape, { badge: badges }))}
      onItemClick={handleClick}
    />
  );
}

export function TmdbRow({
  path,
  params,
  shape = "backdrop",
  badges,
  title,
  subtitle,
  href,
}: {
  path: string;
  params?: Record<string, string | number>;
  shape?: CardShape;
  badges?: boolean;
  title: string;
  subtitle?: string;
  href?: string;
}) {
  const data = useTmdb<TmdbPage>(path, params);
  if (data === null) return null;

  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      href={href}
      shape={shape}
      badges={badges}
      items={data ? normalizeListItems(path, data.results) : undefined}
    />
  );
}

const continueTmdbType = (entry: ContinueWatchingEntry) =>
  entry.mediaType === "movie" || entry.mediaType === "anime:movie" ? "movie" : "tv";

export function BecauseYouWatchedRow() {
  const [entry, setEntry] = useState<ContinueWatchingEntry | null>(null);

  useEffect(() => {
    setEntry(listContinueWatching()[0] || null);
  }, []);

  const type = entry ? continueTmdbType(entry) : null;
  const data = useTmdb<{ recommendations?: TmdbPage }>(entry ? `${type}/${entry.tmdbId}` : null, {
    append_to_response: "recommendations",
  });

  if (!entry || data === null) return null;

  return (
    <ListRow
      title={`Because you watched ${entry.title}`}
      subtitle="Picked from what you watched last"
      shape="backdrop"
      items={data ? normalizeListItems("", data.recommendations?.results) : undefined}
    />
  );
}

// IDs from TMDB's US watch-provider list; logos come from the same endpoint.
const PROVIDERS = [
  { id: 8, name: "Netflix" },
  { id: 9, name: "Prime Video" },
  { id: 337, name: "Disney+" },
  { id: 1899, name: "HBO Max" },
  { id: 350, name: "Apple TV" },
  { id: 15, name: "Hulu" },
  { id: 2303, name: "Paramount+" },
  { id: 283, name: "Crunchyroll" },
];

type WatchProvider = { provider_id: number; logo_path?: string };

export function ProvidersRow() {
  const [providerId, setProviderId] = useState(PROVIDERS[0].id);
  const providerList = useTmdb<{ results?: WatchProvider[] }>("watch/providers/tv", {
    watch_region: "US",
  });
  const discoverParams = {
    with_watch_providers: providerId,
    watch_region: "US",
    sort_by: "popularity.desc",
  };
  const movies = useTmdb<TmdbPage>("discover/movie", discoverParams);
  const shows = useTmdb<TmdbPage>("discover/tv", discoverParams);

  const logos = new Map(
    (providerList?.results || []).map((provider) => [provider.provider_id, provider.logo_path])
  );
  const provider = PROVIDERS.find((entry) => entry.id === providerId)!;

  // Interleave by popularity so both movies and shows make the row.
  const items =
    movies === undefined || shows === undefined
      ? undefined
      : [
          ...normalizeListItems("discover/movie", movies?.results),
          ...normalizeListItems("discover/tv", shows?.results),
        ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const tabs = (
    <div className="provider-tabs" role="tablist" aria-label="Streaming services">
      {PROVIDERS.map((entry) => {
        const logo = logos.get(entry.id);
        return (
          <button
            key={entry.id}
            role="tab"
            aria-selected={entry.id === providerId}
            className={entry.id === providerId ? "provider-tab active" : "provider-tab"}
            onClick={() => setProviderId(entry.id)}
          >
            {logo ? <img src={`${TMDB_IMAGE_BASE_URL}/w92${logo}`} alt="" /> : null}
            <span>{entry.name}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <ListRow
      title={
        <>
          Popular on <span className="accent-text">{provider.name}</span>
        </>
      }
      subtitle="What people are streaming there right now"
      shape="backdrop"
      action={tabs}
      items={items}
    />
  );
}

// Muted per-genre colors keyed by TMDB movie genre ID.
const GENRE_COLORS: Record<number, string> = {
  28: "#b42318",
  12: "#a16207",
  16: "#0f766e",
  35: "#c2410c",
  80: "#44403c",
  99: "#1f3a4d",
  18: "#5b21b6",
  10751: "#0369a1",
  14: "#6d28d9",
  36: "#78350f",
  27: "#7f1d1d",
  10402: "#9d174d",
  9648: "#312e81",
  10749: "#be185d",
  878: "#1d4e89",
  10770: "#334155",
  53: "#3f3f46",
  10752: "#4d5d2a",
  37: "#92400e",
};

type Genre = { id: number; name: string };

export function GenreTiles() {
  const data = useTmdb<{ genres?: Genre[] }>("genre/movie/list");
  if (data === null || (data && !data.genres?.length)) return null;

  const tiles = data?.genres
    ? [
        { key: "anime", name: "Anime", href: "/browse/anime", color: "#0f766e" },
        ...data.genres
          .filter((genre) => genre.id !== 16 && genre.id !== 10770)
          .map((genre) => ({
            key: String(genre.id),
            name: genre.name,
            href: `/browse/movie?genre=${genre.id}`,
            color: GENRE_COLORS[genre.id] || "#334155",
          })),
      ]
    : [];

  return (
    <section className="media-row">
      <SectionHeader title="Browse by genre" subtitle="Jump straight to what you're in the mood for" />
      <RowScroller label="genres">
        {data
          ? tiles.map((tile) => (
              <Link
                key={tile.key}
                href={tile.href}
                className="genre-tile"
                style={{ "--genre-accent": tile.color } as CSSProperties}
              >
                {tile.name}
              </Link>
            ))
          : Array.from({ length: 8 }, (_, index) => (
              <span key={index} className="genre-tile skeleton" aria-hidden />
            ))}
      </RowScroller>
    </section>
  );
}
