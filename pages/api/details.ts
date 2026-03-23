import type { NextApiRequest, NextApiResponse } from "next";

import {
  MediaCategory,
  TmdbType,
  tmdbGet,
  toMediaDetail,
} from "../../lib/tmdb";
import {
  DownloaderLogger,
  fetchVideasyDownloadData,
} from "../../utils/videasyDownloader";

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

function parseDebugFlag(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
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
  logger?: DownloaderLogger;
}): Promise<ResolvedSource | null> {
  const log = input.logger;
  log?.("resolve:start", {
    tmdbId: input.tmdbId,
    tmdbType: input.tmdbType,
    title: input.title,
    releaseYear: input.releaseYear,
    totalSeasons: input.totalSeasons,
    preferredSeasonId: input.preferredSeasonId,
    preferredEpisodeId: input.preferredEpisodeId,
    explicitSeasonRequested: input.explicitSeasonRequested,
    explicitEpisodeRequested: input.explicitEpisodeRequested,
  });

  if (input.tmdbType === "movie") {
    log?.("resolve:movie-probe:start");
    const decoded = await fetchVideasyDownloadData({
      tmdbId: input.tmdbId,
      mediaType: "movie",
      title: input.title,
      year: input.releaseYear,
      imdbId: input.imdbId,
    }, { logger: log });

    const primary = decoded.sources.find((source) => Boolean(source.url));
    log?.("resolve:movie-probe:result", {
      sources: decoded.sources.length,
      foundPrimary: Boolean(primary?.url),
    });
    return primary?.url ? { url: primary.url } : null;
  }

  const seasonCandidates = input.explicitSeasonRequested
    ? [input.preferredSeasonId || 1]
    : Array.from({ length: Math.max(1, Math.min(input.totalSeasons || 1, 4)) }, (_, i) => i + 1);
  log?.("resolve:tv:season-candidates", { seasonCandidates });

  for (const season of seasonCandidates) {
    let episodeCandidates = input.explicitEpisodeRequested
      ? [input.preferredEpisodeId || 1]
      : [1, 2, 3];

    if (!input.explicitEpisodeRequested) {
      try {
        const seasonPayload = await tmdbGet<TmdbSeasonPayload>(
          `/tv/${input.tmdbId}/season/${season}`
        );
        const episodeCount = Array.isArray(seasonPayload.episodes)
          ? seasonPayload.episodes.length
          : 0;
        if (episodeCount > 0) {
          episodeCandidates = Array.from(
            { length: Math.min(episodeCount, 8) },
            (_, i) => i + 1
          );
        }
        log?.("resolve:tv:season-details", {
          season,
          episodeCount,
          episodeCandidates,
        });
      } catch {
        log?.("resolve:tv:season-details:error", {
          season,
          fallbackEpisodeCandidates: episodeCandidates,
        });
        // Keep default candidates when season details are unavailable.
      }
    }

    for (const episode of episodeCandidates) {
      try {
        log?.("resolve:tv:probe:start", { season, episode });
        const decoded = await fetchVideasyDownloadData({
          tmdbId: input.tmdbId,
          mediaType: "tv",
          title: input.title,
          year: input.releaseYear,
          seasonId: season,
          episodeId: episode,
          totalSeasons: input.totalSeasons,
          imdbId: input.imdbId,
        }, { logger: log });

        const primary = decoded.sources.find((source) => Boolean(source.url));
        log?.("resolve:tv:probe:result", {
          season,
          episode,
          sources: decoded.sources.length,
          foundPrimary: Boolean(primary?.url),
        });
        if (primary?.url) {
          return {
            url: primary.url,
            seasonId: season,
            episodeId: episode,
          };
        }
      } catch (error: any) {
        log?.("resolve:tv:probe:error", {
          season,
          episode,
          error: String(error?.message || error || "unknown-error"),
        });
        // Continue probing other episodes/seasons.
      }
    }
  }

  log?.("resolve:done:no-source");
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const debugEnabled = parseDebugFlag(req.query.debug);
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const debugTrace: Array<{
    at: string;
    step: string;
    data?: Record<string, unknown>;
  }> = [];

  const logger: DownloaderLogger = (step, data) => {
    const entry = {
      at: new Date().toISOString(),
      step,
      data,
    };
    if (debugEnabled) {
      debugTrace.push(entry);
    }
    console.log(`[details-api:${requestId}] ${step}`, data || {});
  };

  logger("request:received", {
    method: req.method,
    query: {
      id: req.query.id,
      tmdbType: req.query.tmdbType,
      category: req.query.category,
      seasonId: req.query.seasonId,
      episodeId: req.query.episodeId,
      debug: req.query.debug,
    },
  });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    logger("request:rejected-method", { method: req.method });
    return res.status(405).json({
      error: "Method not allowed",
      ...(debugEnabled ? { debugRequestId: requestId, debugTrace } : {}),
    });
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
    logger("request:validation-error", {
      hasId: Boolean(id),
      hasTmdbType: Boolean(tmdbType),
    });
    return res.status(400).json({
      error: "Missing required query params `id` and `tmdbType`.",
      ...(debugEnabled ? { debugRequestId: requestId, debugTrace } : {}),
    });
  }

  try {
    logger("tmdb:detail:fetch:start", { tmdbType, id });
    const append =
      tmdbType === "movie" ? "external_ids" : "external_ids";
    const payload = await tmdbGet<TmdbDetailPayload>(`/${tmdbType}/${id}`, {
      append_to_response: append,
    });
    logger("tmdb:detail:fetch:done", {
      title: payload.title || payload.name,
      first_air_date: payload.first_air_date,
      release_date: payload.release_date,
      number_of_seasons: payload.number_of_seasons,
      hasImdbId: Boolean(payload.imdb_id || payload.external_ids?.imdb_id),
    });

    const detail = toMediaDetail(payload, tmdbType as TmdbType, category);
    if (!detail) {
      logger("tmdb:detail:not-found");
      return res.status(404).json({
        error: "Title not found.",
        ...(debugEnabled ? { debugRequestId: requestId, debugTrace } : {}),
      });
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
    logger("resolve:inputs", {
      releaseYear,
      seasonId,
      episodeId,
      totalSeasons: tmdbType === "tv" ? Number(payload.number_of_seasons || 0) : undefined,
    });

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
        logger,
      });

      if (resolved?.url) {
        playbackAvailable = true;
        downloadAvailable = true;
        authorizedPlaybackUrl = resolved.url;
        authorizedDownloadUrl = resolved.url;
        logger("resolve:success", {
          url: resolved.url,
          seasonId: resolved.seasonId,
          episodeId: resolved.episodeId,
        });
        availabilityNote =
          tmdbType === "tv" && resolved.seasonId && resolved.episodeId
            ? `Playback and download are enabled via Videasy source authorization (S${resolved.seasonId}E${resolved.episodeId}).`
            : "Playback and download are currently enabled via Videasy source authorization.";
      } else {
        logger("resolve:no-source");
        availabilityNote =
          "Playback/download source resolution failed: No sources returned from probed Videasy episodes.";
      }
    } catch (error: any) {
      logger("resolve:error", {
        error: String(error?.message || error || "unknown-error"),
      });
      availabilityNote =
        error?.message
          ? `Playback/download source resolution failed: ${String(error.message)}`
          : detail.availabilityNote;
    }

    logger("response:ready", {
      playbackAvailable,
      downloadAvailable,
      authorizedPlaybackUrl,
      authorizedDownloadUrl,
    });

    return res.status(200).json({
      ...detail,
      playbackAvailable,
      downloadAvailable,
      authorizedPlaybackUrl,
      authorizedDownloadUrl,
      availabilityNote,
      ...(debugEnabled ? { debugRequestId: requestId, debugTrace } : {}),
    });
  } catch (error: any) {
    logger("request:unhandled-error", {
      error: String(error?.message || error || "unknown-error"),
    });
    return res.status(500).json({
      error: error?.message || "Failed to load title details.",
      ...(debugEnabled ? { debugRequestId: requestId, debugTrace } : {}),
    });
  }
}
