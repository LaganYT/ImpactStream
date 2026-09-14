import type { NextApiRequest, NextApiResponse } from "next";

import { MediaSummary, tmdbGet, toMediaSummary } from "../../lib/tmdb";

type TmdbListResponse = {
  results?: any[];
};

type HomeSection = {
  id: string;
  title: string;
  items: MediaSummary[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [movieTrend, tvTrend, popularMovies, onTheAir, animeShows] =
      await Promise.all([
        tmdbGet<TmdbListResponse>("/trending/movie/day"),
        tmdbGet<TmdbListResponse>("/trending/tv/day"),
        tmdbGet<TmdbListResponse>("/movie/popular"),
        tmdbGet<TmdbListResponse>("/tv/on_the_air"),
        tmdbGet<TmdbListResponse>("/discover/tv", {
          with_genres: 16,
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }),
      ]);

    const trending = [
      ...(movieTrend.results || [])
        .map((item) => toMediaSummary(item, "movie"))
        .filter(Boolean),
      ...(tvTrend.results || [])
        .map((item) => toMediaSummary(item, "tv"))
        .filter(Boolean),
    ]
      .sort((a, b) => (b?.popularity || 0) - (a?.popularity || 0))
      .slice(0, 18) as MediaSummary[];

    const sections: HomeSection[] = [
      {
        id: "trending",
        title: "Trending Now",
        items: trending,
      },
      {
        id: "movies",
        title: "Popular Movies",
        items: ((popularMovies.results || [])
          .map((item) => toMediaSummary(item, "movie"))
          .filter(Boolean)
          .slice(0, 18)) as MediaSummary[],
      },
      {
        id: "shows",
        title: "On The Air",
        items: ((onTheAir.results || [])
          .map((item) => toMediaSummary(item, "tv"))
          .filter(Boolean)
          .slice(0, 18)) as MediaSummary[],
      },
      {
        id: "anime",
        title: "Anime Spotlight",
        items: ((animeShows.results || [])
          .map((item) => toMediaSummary(item, "tv"))
          .filter(Boolean)
          .slice(0, 18)) as MediaSummary[],
      },
    ];

    return res.status(200).json({
      hero: trending[0] || null,
      sections,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Failed to load home feed.",
    });
  }
}
