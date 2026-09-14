import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { fetchVideasyDownloadData } from "../utils/videasyDownloader";

type DetailResponse = {
  id: string;
  tmdbType: "movie" | "tv";
  title: string;
  releaseYear?: string;
  imdbId?: string | null;
  totalSeasons?: number;
  sourceResolutionInput?: {
    request?: {
      tmdbId: number;
      mediaType: "movie" | "tv";
      title: string;
      year?: string;
      seasonId?: number;
      episodeId?: number;
      totalSeasons?: number;
      imdbId?: string;
    };
  };
};

export default function BrowserResolvePage() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const params = useMemo(() => {
    const id = typeof router.query.id === "string" ? router.query.id : "";
    const tmdbType = router.query.tmdbType === "tv" ? "tv" : router.query.tmdbType === "movie" ? "movie" : null;
    const category =
      router.query.category === "anime" || router.query.category === "tv" || router.query.category === "movie"
        ? router.query.category
        : tmdbType || "movie";

    const seasonId = Number(router.query.seasonId || 1);
    const episodeId = Number(router.query.episodeId || 1);

    return {
      id,
      tmdbType,
      category,
      seasonId: Number.isFinite(seasonId) && seasonId > 0 ? seasonId : 1,
      episodeId: Number.isFinite(episodeId) && episodeId > 0 ? episodeId : 1,
    };
  }, [router.query]);

  useEffect(() => {
    if (!params.id || !params.tmdbType) return;

    let cancelled = false;

    const run = async () => {
      setError("");
      setResult({ status: "loading", params });

      try {
        const detailRes = await fetch(
          `/api/details?id=${encodeURIComponent(params.id)}&tmdbType=${params.tmdbType}&category=${params.category}`
        );
        if (!detailRes.ok) {
          throw new Error(`/api/details failed: ${detailRes.status}`);
        }

        const detail = (await detailRes.json()) as DetailResponse;
        const baseRequest = detail.sourceResolutionInput?.request;

        if (!baseRequest) {
          throw new Error("Missing sourceResolutionInput.request in /api/details response.");
        }

        const decoded = await fetchVideasyDownloadData(
          {
            ...baseRequest,
            seasonId: detail.tmdbType === "tv" ? params.seasonId : undefined,
            episodeId: detail.tmdbType === "tv" ? params.episodeId : undefined,
          },
          {
            logger: (step, data) => {
              if (step.startsWith("fetch:") || step.startsWith("endpoint:")) {
                console.log("[videasy]", step, data || {});
              }
            },
          }
        );

        if (cancelled) return;

        const primary = decoded.sources.find((source) => Boolean(source.url));
        setResult({
          status: "ok",
          detail,
          sourceResolution: {
            loadingSources: false,
            playbackAvailable: Boolean(primary?.url),
            downloadAvailable: Boolean(primary?.url),
            authorizedPlaybackUrl: primary?.url || null,
            authorizedDownloadUrl: primary?.url || null,
            availabilityNote: primary?.url
              ? "Sources resolved in browser."
              : "No sources returned from Videasy.",
            sources: decoded.sources,
            subtitles: decoded.subtitles,
          },
        });
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Resolution failed.");
        setResult({ status: "error", params, message: err?.message || "Resolution failed." });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <main style={{ padding: 16, fontFamily: "ui-monospace, Menlo, monospace" }}>
      <h1>Browser Videasy Resolver</h1>
      <p>
        URL format: <code>/browser-resolve?id=78191&tmdbType=tv&category=tv&seasonId=1&episodeId=1</code>
      </p>
      {error ? <p style={{ color: "#b91c1c" }}>Error: {error}</p> : null}
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(result || { status: "idle" }, null, 2)}
      </pre>
    </main>
  );
}
