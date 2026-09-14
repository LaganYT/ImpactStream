import type { NextApiRequest, NextApiResponse } from "next";

import {
  MediaSummary,
  TmdbMediaPayload,
  tmdbGet,
  toMediaSummary,
} from "../../lib/tmdb";

type TmdbListResponse = {
  results?: TmdbMediaPayload[];
};

type HomeSection = {
  id: string;
  title: string;
  items: MediaSummary[];
};

function compactMedia(items: Array<MediaSummary | null>): MediaSummary[] {
  return items.filter((item): item is MediaSummary => Boolean(item));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [movieTrend, tvTrend, popularMovies, onTheAir, animeShows] = await Promise.all([
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

    const trending = compactMedia([
      ...(movieTrend.results || []).map((item) => toMediaSummary(item, "movie")),
      ...(tvTrend.results || []).map((item) => toMediaSummary(item, "tv")),
    ])
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 18);

    const sections: HomeSection[] = [
      {
        id: "trending",
        title: "Trending Now",
        items: trending,
      },
      {
        id: "movies",
        title: "Popular Movies",
        items: compactMedia(
          (popularMovies.results || []).map((item) => toMediaSummary(item, "movie"))
        ).slice(0, 18),
      },
      {
        id: "shows",
        title: "On The Air",
        items: compactMedia(
          (onTheAir.results || []).map((item) => toMediaSummary(item, "tv"))
        ).slice(0, 18),
      },
      {
        id: "anime",
        title: "Anime Spotlight",
        items: compactMedia(
          (animeShows.results || []).map((item) => toMediaSummary(item, "tv"))
        ).slice(0, 18),
      },
    ];

    return res.status(200).json({ hero: trending[0] || null, sections });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load home feed.",
    });
  }
}
