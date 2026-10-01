import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ContinueWatchingRow from "../components/ContinueWatchingRow";
import MediaRow, { MediaRowItem } from "../components/MediaRow";
import MyListRow from "../components/MyListRow";
import Billboard, { BillboardItem } from "../components/Billboard";
import { getDetailRoute, getMediaType } from "../utils/mediaRouting";
import { useTitleModal } from "../components/TitleModal";
import { mediaItemKey, TmdbListItem, TmdbPage, toTitleRef } from "../utils/mediaItems";
import { posterUrl } from "../utils/posters";
import { tmdbFetch } from "../utils/tmdbClient";

type HomeRow = {
  id: string;
  title: string;
  path: string;
  params?: Record<string, string | number>;
  browseHref?: string;
};

const HOME_ROWS: HomeRow[] = [
  { id: "trending", title: "Trending Now", path: "trending/all/day" },
  { id: "trendingWeek", title: "Trending This Week", path: "trending/all/week" },
  {
    id: "anime",
    title: "Popular Anime",
    path: "discover/tv",
    params: { with_genres: 16, with_original_language: "ja", sort_by: "popularity.desc" },
    browseHref: "/browse/anime",
  },
  { id: "nowPlaying", title: "Now Playing in Theaters", path: "movie/now_playing" },
  { id: "popularMovies", title: "Popular Movies", path: "movie/popular", browseHref: "/browse/movie" },
  { id: "topRatedMovies", title: "Top Rated Movies", path: "movie/top_rated" },
  { id: "upcomingMovies", title: "Coming Soon", path: "movie/upcoming" },
  { id: "airingToday", title: "Airing Today", path: "tv/airing_today" },
  { id: "onTheAir", title: "New Episodes This Week", path: "tv/on_the_air", browseHref: "/browse/tv" },
];

const getTitle = (item: TmdbListItem) => item.title || item.name || "Untitled";
const getYear = (item: TmdbListItem) =>
  (item.release_date || item.first_air_date || "").slice(0, 4) || undefined;

export default function Home() {
  const [rows, setRows] = useState<Record<string, TmdbListItem[]>>({});
  const [error, setError] = useState("");
  const router = useRouter();
  const { openTitle } = useTitleModal();

  // Old search links used `/?query=`; send them to the dedicated search page.
  const legacyQuery = typeof router.query.query === "string" ? router.query.query : "";
  useEffect(() => {
    if (legacyQuery) router.replace(`/search?q=${encodeURIComponent(legacyQuery)}`);
  }, [legacyQuery, router]);

  useEffect(() => {
    if (legacyQuery) return;

    let cancelled = false;
    Promise.all(
      HOME_ROWS.map((row) =>
        tmdbFetch<TmdbPage>(row.path, row.params).then((data) =>
          (data.results || [])
            .filter((item) => item?.id && (item.media_type ? item.media_type !== "person" : true))
            .map((item) => ({ ...item, media_type: getMediaType(item) }))
        )
      )
    )
      .then((results) => {
        if (cancelled) return;
        setRows(Object.fromEntries(HOME_ROWS.map((row, index) => [row.id, results[index]])));
      })
      .catch(() => {
        if (!cancelled) setError("Something went wrong while loading content. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [legacyQuery]);

  const featured = useMemo(
    () =>
      [...(rows.trending || [])]
        .filter((item) => item.backdrop_path && item.overview)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 6),
    [rows.trending]
  );

  const billboardItems: BillboardItem[] = featured.map((item) => ({
    id: mediaItemKey(item),
    title: getTitle(item),
    backdropUrl: `https://image.tmdb.org/t/p/original${item.backdrop_path}`,
    overview: item.overview,
    rating: item.vote_average,
    year: getYear(item),
    typeLabel: getMediaType(item) === "tv" ? "SERIES" : "MOVIE",
  }));

  const handleBillboardAction = (play: boolean) => (billboardItem: BillboardItem) => {
    const match = featured.find((item) => mediaItemKey(item) === billboardItem.id);
    if (!match) return;
    if (play) router.push(getDetailRoute(match));
    else openTitle(toTitleRef(match));
  };

  const toRowItems = (items: TmdbListItem[]): MediaRowItem[] =>
    items.slice(0, 18).map((item) => ({
      id: mediaItemKey(item),
      title: getTitle(item),
      posterUrl: posterUrl(item.poster_path),
      year: getYear(item),
      rating: item.vote_average,
    }));

  const handleRowClick = (items: TmdbListItem[]) => (row: MediaRowItem) => {
    const match = items.find((item) => mediaItemKey(item) === row.id);
    if (match) openTitle(toTitleRef(match));
  };

  if (legacyQuery) return <div className="loading">Loading</div>;

  return (
    <div className="home discover-home">
      {billboardItems.length ? (
        <Billboard
          items={billboardItems}
          getKicker={(_, index) => `#${index + 1} Trending Today`}
          onPlay={handleBillboardAction(true)}
          onInfo={handleBillboardAction(false)}
        />
      ) : (
        <div className="billboard-loading">
          <div className="loading">Loading</div>
        </div>
      )}

      <main className="home-rows">
        {error ? <p className="discover-error">{error}</p> : null}

        <ContinueWatchingRow maxItems={12} />
        <MyListRow />

        {HOME_ROWS.map((row) => (
          <MediaRow
            key={row.id}
            title={row.title}
            action={
              row.browseHref ? (
                <Link href={row.browseHref} className="media-row-link">
                  Browse all
                </Link>
              ) : undefined
            }
            items={toRowItems(rows[row.id] || [])}
            onItemClick={handleRowClick(rows[row.id] || [])}
          />
        ))}
      </main>
    </div>
  );
}
