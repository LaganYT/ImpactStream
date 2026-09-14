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

  const searchTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!searchTerm) {
    return res.status(400).json({ error: "Missing search query `q`." });
  }

  try {
    const [movieResults, tvResults] = await Promise.all([
      tmdbGet<TmdbListResponse>("/search/movie", { query: searchTerm }),
      tmdbGet<TmdbListResponse>("/search/tv", { query: searchTerm }),
    ]);

    const mergedResults = compactMedia([
      ...(movieResults.results || []).map((item) => toMediaSummary(item, "movie")),
      ...(tvResults.results || []).map((item) => toMediaSummary(item, "tv")),
    ]);

    const uniqueResults = Array.from(
      new Map(
        mergedResults
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .map((item) => [`${item.tmdbType}-${item.id}`, item])
      ).values()
    );

    return res.status(200).json({ query: searchTerm, results: uniqueResults });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to search titles.",
    });
  }
}
