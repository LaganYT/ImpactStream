import { useEffect, useMemo, useState } from "react";
import {
  DownloadRequest,
  SourceItem,
  SubtitleItem,
  fetchVideasyDownloadData,
} from "../utils/videasyDownloader";

type ResolveStatus = {
  loadingSources: boolean;
  playbackAvailable: boolean;
  downloadAvailable: boolean;
  authorizedPlaybackUrl: string | null;
  authorizedDownloadUrl: string | null;
  availabilityNote: string;
  resolvedSources: SourceItem[];
  resolvedSubtitles: SubtitleItem[];
};

type UseVideasySourceResolutionArgs = {
  enabled: boolean;
  request: DownloadRequest | null;
};

const INITIAL_STATUS: ResolveStatus = {
  loadingSources: false,
  playbackAvailable: false,
  downloadAvailable: false,
  authorizedPlaybackUrl: null,
  authorizedDownloadUrl: null,
  availabilityNote: "Source availability has not been resolved yet.",
  resolvedSources: [],
  resolvedSubtitles: [],
};

export function useVideasySourceResolution({
  enabled,
  request,
}: UseVideasySourceResolutionArgs): ResolveStatus {
  const [status, setStatus] = useState<ResolveStatus>(INITIAL_STATUS);

  const requestKey = useMemo(() => JSON.stringify(request || {}), [request]);

  useEffect(() => {
    if (!enabled || !request) {
      setStatus(INITIAL_STATUS);
      return;
    }

    let isCancelled = false;

    setStatus((current) => ({
      ...current,
      loadingSources: true,
      availabilityNote: "Resolving playback/download sources from Videasy...",
    }));

    fetchVideasyDownloadData(request, {
      logger: (step, data) => {
        if (step.startsWith("fetch:") || step.startsWith("endpoint:")) {
          console.log("[videasy]", step, data || {});
        }
      },
    })
      .then((decoded) => {
        if (isCancelled) return;

        const primary = decoded.sources.find((source) => Boolean(source.url));
        const primaryUrl = primary?.url || null;
        const sourcesCount = decoded.sources.length;
        const subtitlesCount = decoded.subtitles.length;

        setStatus({
          loadingSources: false,
          playbackAvailable: Boolean(primaryUrl),
          downloadAvailable: Boolean(primaryUrl),
          authorizedPlaybackUrl: primaryUrl,
          authorizedDownloadUrl: primaryUrl,
          availabilityNote: primaryUrl
            ? `Resolved ${sourcesCount} source${
                sourcesCount === 1 ? "" : "s"
              } and ${subtitlesCount} subtitle${
                subtitlesCount === 1 ? "" : "s"
              } from Videasy.`
            : "No playable sources were returned by Videasy.",
          resolvedSources: decoded.sources || [],
          resolvedSubtitles: decoded.subtitles || [],
        });
      })
      .catch((error: any) => {
        if (isCancelled) return;

        setStatus({
          loadingSources: false,
          playbackAvailable: false,
          downloadAvailable: false,
          authorizedPlaybackUrl: null,
          authorizedDownloadUrl: null,
          availabilityNote: `Couldn't resolve playback/download sources in-browser: ${
            error?.message || "Unknown Videasy error"
          }`,
          resolvedSources: [],
          resolvedSubtitles: [],
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [enabled, request, requestKey]);

  return status;
}
