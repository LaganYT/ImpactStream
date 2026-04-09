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

type TmdbSeasonPayload = {
  episodes?: Array<{ episode_number?: number }>;
};

type ResolvedSource = {
  url: string;
  seasonId?: number;
  episodeId?: number;
};

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function resolvePrimaryVideasySource(input: {
  tmdbId: number;
  tmdbType: TmdbType;
  title: string;
  releaseYear?: string;
  totalSeasons?: number;
  imdbId?: string;
  preferredSeasonId?: number;
  preferredEpisodeId?: number;
  explicitSeasonRequested: boolean;
  explicitEpisodeRequested: boolean;
}): Promise<ResolvedSource | null> {
  console.log("[details] resolvePrimaryVideasySource:start", {
    tmdbId: input.tmdbId,
    tmdbType: input.tmdbType,
    title: input.title,
    releaseYear: input.releaseYear,
    totalSeasons: input.totalSeasons,
    imdbId: input.imdbId,
    preferredSeasonId: input.preferredSeasonId,
    preferredEpisodeId: input.preferredEpisodeId,
    explicitSeasonRequested: input.explicitSeasonRequested,
    explicitEpisodeRequested: input.explicitEpisodeRequested,
  });

  if (input.tmdbType === "movie") {
    console.log("[details] videasy probe:movie", {
      tmdbId: input.tmdbId,
      mediaType: "movie",
      title: input.title,
      year: input.releaseYear,
      imdbId: input.imdbId,
    });

    const decoded = await fetchVideasyDownloadData({
      tmdbId: input.tmdbId,
      mediaType: "movie",
      title: input.title,
      year: input.releaseYear,
      imdbId: input.imdbId,
    });

    console.log("[details] videasy result:movie", {
      sourceCount: decoded.sources.length,
      sources: decoded.sources.map((source) => ({
        url: source.url,
      })),
    });

    const primary = decoded.sources.find((source) => Boolean(source.url));
    return primary?.url ? { url: primary.url } : null;
  }

  const seasonCandidates = input.explicitSeasonRequested
    ? [input.preferredSeasonId || 1]
    : Array.from(
        { length: Math.max(1, Math.min(input.totalSeasons || 1, 4)) },
        (_, i) => i + 1
      );

  console.log("[details] tv season candidates", { seasonCandidates });

  for (const season of seasonCandidates) {
    let episodeCandidates = input.explicitEpisodeRequested
      ? [input.preferredEpisodeId || 1]
      : [1, 2, 3];

    if (!input.explicitEpisodeRequested) {
      const tmdbSeasonEndpoint = `/tv/${input.tmdbId}/season/${season}`;

      try {
        console.log("[details] tmdb season probe:start", {
          endpoint: tmdbSeasonEndpoint,
          season,
        });

        const seasonPayload = await tmdbGet<TmdbSeasonPayload>(
          tmdbSeasonEndpoint
        );

        const episodeCount = Array.isArray(seasonPayload.episodes)
          ? seasonPayload.episodes.length
          : 0;

        console.log("[details] tmdb season probe:success", {
          endpoint: tmdbSeasonEndpoint,
          season,
          episodeCount,
        });

        if (episodeCount > 0) {
          episodeCandidates = Array.from(
            { length: Math.min(episodeCount, 8) },
            (_, i) => i + 1
          );
        }
      } catch (error: any) {
        console.error("[details] tmdb season probe:error", {
          endpoint: tmdbSeasonEndpoint,
          season,
          message: error?.message || String(error),
        });
        // Keep default candidates when season details are unavailable.
      }
    }

    console.log("[details] tv episode candidates", {
      season,
      episodeCandidates,
    });

    for (const episode of episodeCandidates) {
      try {
        console.log("[details] videasy probe:tv:start", {
          tmdbId: input.tmdbId,
          mediaType: "tv",
          title: input.title,
          year: input.releaseYear,
          seasonId: season,
          episodeId: episode,
          totalSeasons: input.totalSeasons,
          imdbId: input.imdbId,
        });

        const decoded = await fetchVideasyDownloadData({
          tmdbId: input.tmdbId,
          mediaType: "tv",
          title: input.title,
          year: input.releaseYear,
          seasonId: season,
          episodeId: episode,
          totalSeasons: input.totalSeasons,
          imdbId: input.imdbId,
        });

        console.log("[details] videasy probe:tv:result", {
          seasonId: season,
          episodeId: episode,
          sourceCount: decoded.sources.length,
          sources: decoded.sources.map((source) => ({
            url: source.url,
          })),
        });

        const primary = decoded.sources.find((source) => Boolean(source.url));
        if (primary?.url) {
          console.log("[details] videasy probe:tv:success", {
            seasonId: season,
            episodeId: episode,
            url: primary.url,
          });

          return {
            url: primary.url,
            seasonId: season,
            episodeId: episode,
          };
        }
      } catch (error: any) {
        console.error("[details] videasy probe:tv:error", {
          seasonId: season,
          episodeId: episode,
          message: error?.message || String(error),
        });
        // Continue probing other episodes/seasons.
      }
    }
  }

  console.warn("[details] resolvePrimaryVideasySource:no-source-found", {
    tmdbId: input.tmdbId,
    tmdbType: input.tmdbType,
  });

  return null;
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
  const hasSeasonQuery = typeof req.query.seasonId === "string";
  const hasEpisodeQuery = typeof req.query.episodeId === "string";
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
      const resolved = await resolvePrimaryVideasySource({
        tmdbId: Number(id),
        title: payload.title || payload.name || detail.title,
        tmdbType,
        releaseYear: releaseYear || undefined,
        preferredSeasonId: seasonId,
        preferredEpisodeId: episodeId,
        totalSeasons: tmdbType === "tv" ? Number(payload.number_of_seasons || 0) : undefined,
        imdbId: payload.imdb_id || payload.external_ids?.imdb_id || undefined,
        explicitSeasonRequested: hasSeasonQuery,
        explicitEpisodeRequested: hasEpisodeQuery,
      });

      if (resolved?.url) {
        playbackAvailable = true;
        downloadAvailable = true;
        authorizedPlaybackUrl = resolved.url;
        authorizedDownloadUrl = resolved.url;
        availabilityNote =
          tmdbType === "tv" && resolved.seasonId && resolved.episodeId
            ? `Playback and download are enabled via Videasy source authorization (S${resolved.seasonId}E${resolved.episodeId}).`
            : "Playback and download are currently enabled via Videasy source authorization.";
      } else {
        availabilityNote =
          "Playback/download source resolution failed: No sources returned from probed Videasy episodes.";
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
