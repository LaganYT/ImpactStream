import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

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

  const openAnime = (item: AnimeItem) => {
    const type = item.media_type || "tv";
    router.push({ pathname: `/anime/${item.id}`, query: { type } });
  };

  const getTitle = (item: AnimeItem) => item.name || item.title || "Untitled";
  const getPoster = (item: AnimeItem) =>
    item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/no-image.svg";

  const getHero = featured[0] || topRated[0] || trending[0];

  return (
    <div className="home discover-home">
      <main className="container discover-shell">
        <section className="discover-hero">
          <div className="discover-hero-copy">
            <p className="discover-kicker">Anime Hub</p>
            <h1>Stream the best anime in one place.</h1>
            <p>
              Browse top picks, trending episodes, and fan favorites with one-click playback.
            </p>
          </div>

          {getHero ? (
            <div className="discover-spotlight" onClick={() => openAnime(getHero)}>
              <img
                src={
                  getHero.backdrop_path
                    ? `https://image.tmdb.org/t/p/original${getHero.backdrop_path}`
                    : getPoster(getHero)
                }
                alt={getTitle(getHero)}
              />
              <div className="discover-spotlight-overlay">
                <span>Featured Anime</span>
                <h3>{getTitle(getHero)}</h3>
              </div>
            </div>
          ) : null}
        </section>

        {isLoading ? <div className="loading">Loading anime catalog</div> : null}
        {error ? <p className="discover-error">{error}</p> : null}

        {!isLoading && !error ? (
          <section className="categories">
            <div className="category discover-category">
              <h3>Popular Anime</h3>
              <div className="category-scroll">
                {featured.slice(0, 20).map((item) => (
                  <div key={`popular-${item.id}`} className="category-item" onClick={() => openAnime(item)}>
                    <img src={getPoster(item)} alt={getTitle(item)} />
                    <h4>{getTitle(item)}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="category discover-category">
              <h3>Top Rated Anime</h3>
              <div className="category-scroll">
                {topRated.slice(0, 20).map((item) => (
                  <div key={`top-${item.id}`} className="category-item" onClick={() => openAnime(item)}>
                    <img src={getPoster(item)} alt={getTitle(item)} />
                    <h4>{getTitle(item)}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="category discover-category">
              <h3>Trending This Week</h3>
              <div className="category-scroll">
                {trending.slice(0, 20).map((item) => (
                  <div key={`trend-${item.id}`} className="category-item" onClick={() => openAnime(item)}>
                    <img src={getPoster(item)} alt={getTitle(item)} />
                    <h4>{getTitle(item)}</h4>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
