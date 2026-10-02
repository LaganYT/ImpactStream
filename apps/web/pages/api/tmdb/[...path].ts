import type { NextApiRequest, NextApiResponse } from "next";

import { tmdbGet } from "../../../lib/tmdb";

// Only the TMDB endpoints the web client actually uses are forwarded, so this
// route can't be used as a general-purpose proxy for the server-side API key.
const ALLOWED_PATHS = [
  /^trending\/(all|movie|tv)\/(day|week)$/,
  /^search\/(movie|tv|multi)$/,
  /^discover\/(movie|tv)$/,
  /^genre\/(movie|tv)\/list$/,
  /^movie\/(popular|top_rated|upcoming|now_playing)$/,
  /^tv\/(popular|top_rated|airing_today|on_the_air)$/,
  /^(movie|tv)\/\d+$/,
  /^tv\/\d+\/season\/\d+$/,
];

const ALLOWED_PARAMS = new Set([
  "query",
  "page",
  "language",
  "append_to_response",
  "with_genres",
  "with_original_language",
  "sort_by",
  "include_adult",
  "vote_count.gte",
  "first_air_date.gte",
  "first_air_date.lte",
  "primary_release_date.gte",
  "primary_release_date.lte",
  "without_genres",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path || ""];
  const path = segments.join("/");

  if (!ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
    return res.status(404).json({ error: "Unsupported TMDB endpoint." });
  }

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path" || !ALLOWED_PARAMS.has(key)) continue;
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (firstValue) params[key] = firstValue;
  }

  try {
    const data = await tmdbGet<unknown>(`/${path}`, params);
    res.setHeader(
      "Cache-Control",
      path.startsWith("search/")
        ? "s-maxage=300, stale-while-revalidate=600"
        : "s-maxage=1800, stale-while-revalidate=3600"
    );
    return res.status(200).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "TMDB request failed.";
    const status = /\b404\b/.test(message) ? 404 : 502;
    return res.status(status).json({ error: message });
  }
}
