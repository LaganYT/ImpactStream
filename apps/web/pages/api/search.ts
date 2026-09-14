import type { NextApiRequest, NextApiResponse } from "next";

import { MediaSummary, tmdbGet, toMediaSummary } from "../../lib/tmdb";

type TmdbListResponse = {
  results?: any[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    return res.status(400).json({ error: "Missing search query `q`." });
  }

  try {
    const [movieResults, tvResults] = await Promise.all([
      tmdbGet<TmdbListResponse>("/search/movie", { query }),
      tmdbGet<TmdbListResponse>("/search/tv", { query }),
    ]);

    const merged = [
      ...(movieResults.results || [])
        .map((item) => toMediaSummary(item, "movie"))
        .filter(Boolean),
      ...(tvResults.results || [])
        .map((item) => toMediaSummary(item, "tv"))
        .filter(Boolean),
    ] as MediaSummary[];

    const unique = Array.from(
      new Map(
        merged
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .map((item) => [`${item.tmdbType}-${item.id}`, item])
      ).values()
    );

    return res.status(200).json({
      query,
      results: unique,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Failed to search titles.",
    });
  }
}
