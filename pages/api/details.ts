import type { NextApiRequest, NextApiResponse } from "next";

import {
  MediaCategory,
  TmdbType,
  tmdbGet,
  toMediaDetail,
} from "../../lib/tmdb";
import { fetchVideasyDownloadData } from "../../utils/videasyDownloader";

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

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
    req.query.tmdbType === "tv" ? "tv" : req.query.tmdbType === "movie" ? "movie" : null;
  const category =
    req.query.category === "anime" || req.query.category === "tv" || req.query.category === "movie"
      ? (req.query.category as MediaCategory)
      : undefined;

  if (!id || !tmdbType) {
    return res.status(400).json({
      error: "Missing required query params `id` and `tmdbType`.",
    });
  }

  try {
    const append =
      tmdbType === "movie" ? "external_ids" : "external_ids";
    const payload = await tmdbGet<TmdbDetailPayload>(`/${tmdbType}/${id}`, {
      append_to_response: append,
    });

    const detail = toMediaDetail(payload, tmdbType as TmdbType, category);
    if (!detail) {
      return res.status(404).json({ error: "Title not found." });
    }

    const releaseYear = (payload.release_date || payload.first_air_date || "")
      .slice(0, 4)
      .trim();
    const seasonId = parsePositiveInt(req.query.seasonId, 1);
    const episodeId = parsePositiveInt(req.query.episodeId, 1);

    let playbackAvailable = false;
    let downloadAvailable = false;
    let authorizedPlaybackUrl: string | null = null;
    let authorizedDownloadUrl: string | null = null;
    let availabilityNote = detail.availabilityNote;

    try {
      const decoded = await fetchVideasyDownloadData({
        tmdbId: Number(id),
        mediaType: tmdbType,
        title: payload.title || payload.name || detail.title,
        year: releaseYear || undefined,
        seasonId: tmdbType === "tv" ? seasonId : undefined,
        episodeId: tmdbType === "tv" ? episodeId : undefined,
        totalSeasons:
          tmdbType === "tv" ? Number(payload.number_of_seasons || 0) : undefined,
        imdbId: payload.imdb_id || payload.external_ids?.imdb_id || undefined,
      });

      const primarySource = decoded.sources.find((source) => Boolean(source.url));
      if (primarySource?.url) {
        playbackAvailable = true;
        downloadAvailable = true;
        authorizedPlaybackUrl = primarySource.url;
        authorizedDownloadUrl = primarySource.url;
        availabilityNote =
          "Playback and download are currently enabled via Videasy source authorization.";
      }
    } catch (error: any) {
      availabilityNote =
        error?.message
          ? `Playback/download source resolution failed: ${String(error.message)}`
          : detail.availabilityNote;
    }

    return res.status(200).json({
      ...detail,
      playbackAvailable,
      downloadAvailable,
      authorizedPlaybackUrl,
      authorizedDownloadUrl,
      availabilityNote,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Failed to load title details.",
    });
  }
}
