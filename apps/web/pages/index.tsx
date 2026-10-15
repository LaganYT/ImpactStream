import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Billboard, { BillboardItem } from "../components/Billboard";
import ContinueWatchingRow from "../components/ContinueWatchingRow";
import { BecauseYouWatchedRow, GenreTiles, ProvidersRow, TmdbRow } from "../components/HomeRows";
import MyListRow from "../components/MyListRow";
import TopTenRow from "../components/TopTenRow";
import UpcomingEpisodesRow from "../components/UpcomingEpisodesRow";
import { useTitleModal } from "../components/TitleModal";
import { getDetailRoute, getMediaType } from "../utils/mediaRouting";
import {
  backdropUrl,
  EXTRAS_PARAMS,
  getTitle,
  getYear,
  mediaItemKey,
  normalizeListItems,
  pickLogoUrl,
  pickTrailerKey,
  TmdbImages,
  TmdbListItem,
  TmdbPage,
  TmdbVideo,
  toTitleRef,
  typeLabel,
} from "../utils/mediaItems";
import { tmdbFetch, useTmdb } from "../utils/tmdbClient";

type FeaturedDetails = {
  genres?: { name: string }[];
  images?: TmdbImages;
  videos?: { results?: TmdbVideo[] };
};

const FEATURED_COUNT = 6;

function toBillboardItem(
  item: TmdbListItem,
  details: FeaturedDetails | null,
  trending: TmdbListItem[]
): BillboardItem {
  const type = getMediaType(item);
  const rank = trending.filter((entry) => getMediaType(entry) === type).indexOf(item) + 1;
  return {
    id: mediaItemKey(item),
    title: getTitle(item),
    backdropUrl: backdropUrl(item.backdrop_path, "w1280"),
    logoUrl: pickLogoUrl(details?.images),
    overview: item.overview,
    rating: item.vote_average,
    year: getYear(item),
    typeLabel: typeLabel(item),
    genres: (details?.genres || []).slice(0, 2).map((genre) => genre.name),
    rankLabel: `#${rank} in ${type === "tv" ? "shows" : "movies"} today`,
    trailerKey: pickTrailerKey(details?.videos?.results),
  };
}

export default function Home() {
  const router = useRouter();
  const { openTitle } = useTitleModal();
  const trendingPage = useTmdb<TmdbPage>("trending/all/day");
  const trending = trendingPage ? normalizeListItems("trending", trendingPage.results) : undefined;
  const [billboardItems, setBillboardItems] = useState<BillboardItem[] | null>(null);

  // Old search links used `/?query=`; send them to the dedicated search page.
  const legacyQuery = typeof router.query.query === "string" ? router.query.query : "";
  useEffect(() => {
    if (legacyQuery) router.replace(`/search?q=${encodeURIComponent(legacyQuery)}`);
  }, [legacyQuery, router]);

  // The hero waits for logos and trailers so the title doesn't swap from text to logo.
  useEffect(() => {
    if (!trending) return;
    const featured = trending
      .filter((item) => item.backdrop_path && item.overview)
      .slice(0, FEATURED_COUNT);

    let cancelled = false;
    Promise.all(
      featured.map((item) =>
        tmdbFetch<FeaturedDetails>(`${getMediaType(item)}/${item.id}`, {
          append_to_response: "images,videos",
          ...EXTRAS_PARAMS,
        }).catch(() => null)
      )
    ).then((details) => {
      if (!cancelled) {
        setBillboardItems(featured.map((item, index) => toBillboardItem(item, details[index], trending)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trendingPage]);

  const findFeatured = (billboardItem: BillboardItem) =>
    trending?.find((item) => mediaItemKey(item) === billboardItem.id);

  if (legacyQuery) return <div className="loading">Loading</div>;

  return (
    <div className="home">
      {billboardItems?.length ? (
        <Billboard
          items={billboardItems}
          onPlay={(billboardItem) => {
            const match = findFeatured(billboardItem);
            if (match) router.push(getDetailRoute(match));
          }}
          onInfo={(billboardItem) => {
            const match = findFeatured(billboardItem);
            if (match) openTitle(toTitleRef(match));
          }}
        />
      ) : trendingPage === null ? (
        <div className="billboard-spacer" />
      ) : (
        <div className="billboard billboard-skeleton skeleton" aria-hidden />
      )}

      <main className="home-rows">
        {trendingPage === null ? (
          <p className="discover-error">Something went wrong while loading content. Please try again.</p>
        ) : null}

        <ContinueWatchingRow maxItems={12} />
        <TopTenRow items={trending} />
        <UpcomingEpisodesRow />
        <MyListRow />
        <BecauseYouWatchedRow />
        <TmdbRow
          title="Trending this week"
          subtitle="What everyone's watching this week"
          path="trending/all/week"
          badges
        />
        <ProvidersRow />
        <TmdbRow
          title="Popular anime"
          subtitle="The series anime fans can't stop talking about"
          path="discover/tv"
          params={{ with_genres: 16, with_original_language: "ja", sort_by: "popularity.desc" }}
          href="/browse/anime"
        />
        <TmdbRow
          title="In theaters"
          subtitle="Now playing on the big screen"
          path="movie/now_playing"
          shape="poster"
          badges
        />
        <GenreTiles />
        <TmdbRow
          title="Popular movies"
          subtitle="Crowd favorites this month"
          path="movie/popular"
          href="/browse/movie"
          badges
        />
        <TmdbRow
          title="Top rated"
          subtitle="The highest-rated movies of all time"
          path="movie/top_rated"
          shape="poster"
          href="/browse/movie?sort=top"
        />
        <TmdbRow
          title="Coming soon"
          subtitle="Mark your calendar"
          path="movie/upcoming"
          badges
        />
      </main>
    </div>
  );
}
