import type { NextApiRequest, NextApiResponse } from "next";

import { MediaCategory, tmdbGet, toMediaDetail } from "../../lib/tmdb";

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
  }>;
};

type EpisodeSummary = {
  episodeNumber: number;
  name: string | null;
  stillPath: string | null;
  overview: string | null;
};

type SeasonSummary = {
  seasonNumber: number;
  episodeCount: number | null;
  episodes: EpisodeSummary[];
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

    const detail = toMediaDetail(payload, tmdbType, category);
    if (!detail) {
      return res.status(404).json({ error: "Title not found." });
    }

    const imdbId = payload.imdb_id || payload.external_ids?.imdb_id || null;
    const totalSeasons =
      tmdbType === "tv" ? Number(payload.number_of_seasons || 0) : undefined;

    let seasons: SeasonSummary[] | undefined;

    if (tmdbType === "tv") {
      const seasonNumbers =
        payload.seasons && payload.seasons.length > 0
          ? payload.seasons.map((season) => season.season_number)
          : totalSeasons
            ? Array.from({ length: totalSeasons }, (_, index) => index + 1)
            : [];

      seasons = await Promise.all(
        seasonNumbers.map(async (seasonNumber) => {
          try {
            const seasonDetail = await tmdbGet<{
              episodes?: Array<{
                episode_number: number;
                name?: string;
                still_path?: string | null;
                overview?: string | null;
              }>;
            }>(`/tv/${id}/season/${seasonNumber}`);

            const episodes = (seasonDetail.episodes || []).map((episode) => ({
              episodeNumber: episode.episode_number,
              name: episode.name || null,
              stillPath: episode.still_path
                ? `https://image.tmdb.org/t/p/original${episode.still_path}`
                : null,
              overview: episode.overview || null,
            }));

            return {
              seasonNumber,
              episodeCount: seasonDetail.episodes?.length ?? null,
              episodes,
            };
          } catch {
            return { seasonNumber, episodeCount: null, episodes: [] };
          }
        })
      );
    }

    return res.status(200).json({
      ...detail,
      imdbId,
      totalSeasons,
      seasons,
      sourceResolution: {
        strategy: "client",
        request: {
          tmdbId: Number(id),
          mediaType: tmdbType,
          title: payload.title || payload.name || detail.title,
          year: detail.releaseYear || undefined,
          season: tmdbType === "tv" ? 1 : undefined,
          episode: tmdbType === "tv" ? 1 : undefined,
          totalSeasons,
          imdbId: imdbId || undefined,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load title details.",
    });
  }
}
