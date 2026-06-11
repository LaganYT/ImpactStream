import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import MediaRow, { MediaRowItem } from "../components/MediaRow";
import Billboard, { BillboardItem } from "../components/Billboard";

type AnimeItem = {
  id: number;
  name?: string;
  title?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date?: string;
  release_date?: string;
  vote_average?: number;
  popularity?: number;
  media_type?: "movie" | "tv";
};

export default function AnimePage() {
  const router = useRouter();
  const [featured, setFeatured] = useState<AnimeItem[]>([]);
  const [topRated, setTopRated] = useState<AnimeItem[]>([]);
  const [trending, setTrending] = useState<AnimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const decorate = (items: AnimeItem[]) =>
    (items || [])
      .filter((item) => item?.id)
      .map((item) => ({ ...item, media_type: "tv" as const }))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  useEffect(() => {
    const fetchAnime = async () => {
      try {
        setIsLoading(true);
        setError("");

        const [featuredRes, topRatedRes, trendingRes] = await Promise.all([
          axios.get("https://api.themoviedb.org/3/discover/tv", {
            params: {
              api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
              with_genres: 16,
              with_original_language: "ja",
              sort_by: "popularity.desc",
            },
          }),
          axios.get("https://api.themoviedb.org/3/discover/tv", {
            params: {
              api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
              with_genres: 16,
              with_original_language: "ja",
              sort_by: "vote_average.desc",
              "vote_count.gte": 100,
            },
          }),
          axios.get("https://api.themoviedb.org/3/trending/tv/week", {
            params: {
              api_key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
            },
          }),
        ]);

        setFeatured(decorate(featuredRes.data.results || []));
        setTopRated(decorate(topRatedRes.data.results || []));

        const animeTrending = (trendingRes.data.results || []).filter(
          (item: any) => item?.genre_ids?.includes(16)
        );
        setTrending(decorate(animeTrending));
      } catch {
        setError("Could not load anime right now. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnime();
  }, []);

  const openAnime = (item: AnimeItem, play = false) => {
    const type = item.media_type || "tv";
    router.push({
      pathname: `/anime/${item.id}`,
      query: { type, ...(play ? { play: "1" } : {}) },
    });
  };

  const getTitle = (item: AnimeItem) => item.name || item.title || "Untitled";
  const getPoster = (item: AnimeItem) =>
    item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/no-image.svg";
  const getYear = (item: AnimeItem) =>
    item.first_air_date?.slice(0, 4) || item.release_date?.slice(0, 4) || undefined;

  const billboardSource = useMemo(
    () =>
      [...featured, ...trending]
        .filter((item) => item.backdrop_path && item.overview)
        .slice(0, 6),
    [featured, trending]
  );

  const billboardItems: BillboardItem[] = billboardSource.map((item) => ({
    id: String(item.id),
    title: getTitle(item),
    backdropUrl: `https://image.tmdb.org/t/p/original${item.backdrop_path}`,
    overview: item.overview,
    rating: item.vote_average,
    year: getYear(item),
    typeLabel: "ANIME",
  }));

  const handleBillboardAction = (play: boolean) => (billboardItem: BillboardItem) => {
    const match = billboardSource.find((item) => String(item.id) === billboardItem.id);
    if (match) openAnime(match, play);
  };

  const toRowItems = (items: AnimeItem[]): MediaRowItem[] =>
    items.slice(0, 18).map((item) => ({
      id: item.id,
      title: getTitle(item),
      posterUrl: getPoster(item),
      year: getYear(item),
      rating: item.vote_average,
    }));

  const handleRowClick = (items: AnimeItem[]) => (row: MediaRowItem) => {
    const match = items.find((item) => item.id === row.id);
    if (match) openAnime(match);
  };

  return (
    <div className="home discover-home">
      {billboardItems.length ? (
        <Billboard
          items={billboardItems}
          getKicker={() => "Featured Anime"}
          onPlay={handleBillboardAction(true)}
          onInfo={handleBillboardAction(false)}
        />
      ) : (
        <div className="billboard-loading">
          <div className="loading">{isLoading ? "Loading anime" : "Anime"}</div>
        </div>
      )}

      <main className="home-rows">
        {error ? <p className="discover-error">{error}</p> : null}

        <MediaRow
          title="Popular Anime"
          items={toRowItems(featured)}
          onItemClick={handleRowClick(featured)}
        />
        <MediaRow
          title="Top Rated Anime"
          items={toRowItems(topRated)}
          onItemClick={handleRowClick(topRated)}
        />
        <MediaRow
          title="Trending This Week"
          items={toRowItems(trending)}
          onItemClick={handleRowClick(trending)}
        />
      </main>
    </div>
  );
}
