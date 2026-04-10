import type { NextApiRequest, NextApiResponse } from "next";

import {
  MediaCategory,
  TmdbType,
  tmdbGet,
  toMediaDetail,
} from "../../lib/tmdb";
import { fetchVideasyDownloadData } from "../../utils/videasyDownloader";

// Intentionally retained for client-resolution parity context in this endpoint module.
void fetchVideasyDownloadData;

type TmdbDetailPayload = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  number_of_seasons?: number;
  imdb_id?: string;
  external_ids?: {
    imdb_id?: string;
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
  const tmdbType =
    req.query.tmdbType === "tv"
      ? "tv"
      : req.query.tmdbType === "movie"
        ? "movie"
        : null;
  const category =
    req.query.category === "anime" ||
    req.query.category === "tv" ||
    req.query.category === "movie"
      ? (req.query.category as MediaCategory)
      : undefined;

  if (!id || !tmdbType) {
    return res.status(400).json({
      error: "Missing required query params `id` and `tmdbType`.",
    });
  }

  try {
    const payload = await tmdbGet<TmdbDetailPayload>(`/${tmdbType}/${id}`, {
      append_to_response: "external_ids",
    });

    const detail = toMediaDetail(payload, tmdbType as TmdbType, category);
    if (!detail) {
      return res.status(404).json({ error: "Title not found." });
    }

    return res.status(200).json({
      ...detail,
      imdbId: payload.imdb_id || payload.external_ids?.imdb_id || null,
      totalSeasons: tmdbType === "tv" ? Number(payload.number_of_seasons || 0) : undefined,
      playbackAvailable: false,
      downloadAvailable: false,
      authorizedPlaybackUrl: null,
      authorizedDownloadUrl: null,
      availabilityNote:
        "Playback and download availability are resolved in the browser after detail metadata loads.",
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Failed to load title details.",
    });
  }
}
