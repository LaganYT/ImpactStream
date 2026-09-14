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
  seasons?: Array<{
    season_number: number;
    episode_count?: number;
  }>;
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

    const imdbId = payload.imdb_id || payload.external_ids?.imdb_id || null;
    const totalSeasons =
      tmdbType === "tv" ? Number(payload.number_of_seasons || 0) : undefined;

    let episodesPerSeason:
      | Array<{
          seasonNumber: number;
          episodeCount: number | null;
          episodes?: Array<{
            episodeNumber: number;
            name?: string | null;
            stillPath?: string | null;
            overview?: string | null;
          }>;
        }>
      | undefined = undefined;

    if (tmdbType === "tv") {
      const seasonsList: number[] =
        payload.seasons && payload.seasons.length > 0
          ? payload.seasons.map((s) => s.season_number)
          : totalSeasons
          ? Array.from({ length: totalSeasons }, (_, i) => i + 1)
          : [];

      episodesPerSeason = await Promise.all(
        seasonsList.map(async (seasonNumber) => {
          try {
            const seasonDetail = await tmdbGet<{
              episodes?: Array<{
                episode_number: number;
                name?: string;
                still_path?: string | null;
                overview?: string | null;
              }>;
            }>(`/tv/${id}/season/${seasonNumber}`);

            const eps = (seasonDetail.episodes || []).map((e) => ({
              episodeNumber: e.episode_number,
              name: e.name || null,
              stillPath: e.still_path ? `https://image.tmdb.org/t/p/original${e.still_path}` : null,
              overview: e.overview || null,
            }));

            return {
              seasonNumber,
              episodeCount: seasonDetail.episodes ? seasonDetail.episodes.length : null,
              episodes: eps,
            };
          } catch (e) {
            return { seasonNumber, episodeCount: null, episodes: [] };
          }
        })
      );
    }

    return res.status(200).json({
      ...detail,
      imdbId,
      totalSeasons,
      episodesPerSeason,
      playbackAvailable: false,
      downloadAvailable: false,
      authorizedPlaybackUrl: null,
      authorizedDownloadUrl: null,
      availabilityNote:
        "Sources are not resolved by /api/details. Resolve them on the client by calling fetchVideasyDownloadData(...) with sourceResolutionInput.request.",
      sourceResolutionInput: {
        required: true,
        strategy: "client",
        request: {
          tmdbId: Number(id),
          mediaType: tmdbType,
          title: payload.title || payload.name || detail.title,
          year: detail.releaseYear || undefined,
          seasonId: tmdbType === "tv" ? 1 : undefined,
          episodeId: tmdbType === "tv" ? 1 : undefined,
          totalSeasons,
          imdbId: imdbId || undefined,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Failed to load title details.",
    });
  }
}
