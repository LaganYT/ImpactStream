/**
 * CustomPlayer — client-side TypeScript port of authorized_playback_screen.dart
 *
 * Flow:
 *  1. A hidden iframe loads the Videasy player URL.
 *  2. A `message` event listener on the parent window receives the resolved
 *     m3u8 URL that is posted by the injected capture script running inside the
 *     iframe via `window.parent.postMessage`.
 *  3. Hls.js plays the resolved manifest in a native <video> element.
 *  4. Quality variants are parsed from the master playlist and exposed as a
 *     dropdown.  Source selection re-loads the Videasy URL with a different
 *     `server` query parameter so the iframe re-resolves.
 *  5. Progress is saved to / read from localStorage (same key format used by
 *     the existing pages).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CatalogSeason = {
  seasonNumber: number;
  episodeCount: number;
  name?: string;
};

export type PlayerProgress = {
  positionSeconds: number;
  durationSeconds: number;
};

export type CustomPlayerProps = {
  title: string;
  streamUrl: string;
  tmdbId: string;
  tmdbType: "movie" | "tv";
  seasonsLabel?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  seasons?: CatalogSeason[];
  thumbnailUrl?: string;
  /** Initial resume position in seconds, if any. */
  startPosition?: number;
  /** Called whenever playback position changes (debounced ~5 s). */
  onProgress?: (progress: PlayerProgress) => void;
};

type StreamQuality = {
  label: string;
  url: string;
  bandwidth: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_OPTIONS = [
  "Auto",
  "Neon",
  "Yoru",
  "Cypher",
  "Sage",
  "Jett",
  "Reyna",
  "Breach",
  "Vyse",
];

const RESOLVE_TIMEOUT_MS = 45_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isM3u8Url(value: string): boolean {
  try {
    const url = new URL(value, "https://player.videasy.net");
    return /\.m3u8(?:[?#]|$)/i.test(url.pathname + "?" + url.search);
  } catch {
    return false;
  }
}

function normalizeVideasyUrl(input: string): string {
  const trimmed = input.trim();
  const uri = new URL(trimmed);
  if (uri.protocol !== "https:") {
    throw new Error("Only HTTPS Videasy links are supported.");
  }
  if (isM3u8Url(trimmed)) {
    uri.hash = "";
    return uri.toString();
  }
  const host = uri.hostname.toLowerCase();
  if (
    host !== "player.videasy.net" &&
    host !== "videasy.net" &&
    host !== "www.videasy.net"
  ) {
    throw new Error(`Unsupported Videasy host: ${uri.hostname}`);
  }
  if (host === "videasy.net" || host === "www.videasy.net") {
    const path = uri.pathname.replace(/^\/+/, "");
    if (!path.startsWith("movie/") && !path.startsWith("tv/")) {
      throw new Error("Videasy links must start with /movie/... or /tv/...");
    }
    const normalized = new URL(`https://player.videasy.net/${path}`);
    uri.searchParams.forEach((v, k) => normalized.searchParams.set(k, v));
    return normalized.toString();
  }
  if (
    !uri.pathname.startsWith("/movie/") &&
    !uri.pathname.startsWith("/tv/") &&
    !uri.pathname.startsWith("/anime/")
  ) {
    throw new Error("Unsupported Videasy player path.");
  }
  uri.hash = "";
  return uri.toString();
}

function withCacheBuster(value: string): string {
  if (isM3u8Url(value)) return value;
  const uri = new URL(value);
  uri.searchParams.set("_impactstreamResolve", String(Date.now()));
  return uri.toString();
}

function parseStreamQualities(playlist: string, baseUrl: string): StreamQuality[] {
  const lines = playlist.split(/\r?\n/);
  const qualities: StreamQuality[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;

    const bandwidthMatch = /BANDWIDTH=(\d+)/.exec(line);
    const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
    const resolutionMatch = /RESOLUTION=(\d+x\d+)/.exec(line);
    const resolution = resolutionMatch ? resolutionMatch[1] : undefined;
    const uriMatch = /URI="([^"]+)"/.exec(line);
    let child: string | null = uriMatch ? uriMatch[1] : null;

    if (!child) {
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (!next) continue;
        if (next.startsWith("#")) break;
        child = next;
        break;
      }
    }
    if (!child) continue;

    const label = resolution
      ? `${resolution.split("x")[1]}p`
      : bandwidth > 0
      ? `${(bandwidth / 1_000_000).toFixed(1)} Mbps`
      : `Variant ${qualities.length + 1}`;

    qualities.push({
      label,
      url: new URL(child, baseUrl).toString(),
      bandwidth,
    });
  }

  qualities.sort((a, b) => b.bandwidth - a.bandwidth);

  const seenLabels: Record<string, number> = {};
  return qualities.map((q) => {
    const count = (seenLabels[q.label] ?? 0) + 1;
    seenLabels[q.label] = count;
    return count === 1 ? q : { ...q, label: `${q.label} #${count}` };
  });
}

function distributedEpisodeCount(
  seasonNumber: number,
  seasonCount: number,
  totalEpisodes: number | undefined
): number {
  if (!totalEpisodes || totalEpisodes <= 0 || seasonCount <= 0) return 1;
  const base = Math.floor(totalEpisodes / seasonCount);
  const remainder = totalEpisodes % seasonCount;
  return base + (seasonNumber <= remainder ? 1 : 0);
}

function syncEpisodeFromUrl(streamUrl: string): {
  season: number;
  episode: number;
} | null {
  const match = /\/tv\/\d+\/(\d+)\/(\d+)/.exec(streamUrl);
  if (!match) return null;
  const season = parseInt(match[1], 10);
  const episode = parseInt(match[2], 10);
  if (season >= 1 && episode >= 1) return { season, episode };
  return null;
}

// ---------------------------------------------------------------------------
// Capture script injected into the hidden iframe via postMessage bridge
// ---------------------------------------------------------------------------

function buildCaptureScript(resolveToken: number, preferredSource: string | null, preferredQuality: string | null): string {
  const encodedSource = JSON.stringify(preferredSource);
  const encodedQuality = JSON.stringify(preferredQuality);
  // We use window.parent.postMessage so the parent Next.js page receives the
  // m3u8 URL without any cross-origin WebView channel.
  return `(function(){
    const resolveToken = ${resolveToken};
    const preferredSource = ${encodedSource};
    const preferredQuality = ${encodedQuality};
    const captureStartedAt = Date.now();
    let sourceReady = !preferredSource;
    let qualityReady = !preferredQuality;

    const m3u8Pattern = /\\.m3u8(?:[?#]|$)/i;
    const postM3u8 = function(value) {
      try {
        if (!value || typeof value !== 'string' || !m3u8Pattern.test(value)) return;
        if ((!sourceReady || !qualityReady) && Date.now() - captureStartedAt < 7000) return;
        const url = new URL(value, window.location.href);
        const clean = url.href.split('#')[0];
        window.parent.postMessage({ type: '__impactstream_m3u8__', resolveToken, url: clean }, '*');
      } catch(_) {}
    };

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function() {
        try {
          const first = arguments[0];
          postM3u8(typeof first === 'string' ? first : first && first.url);
        } catch(_) {}
        return originalFetch.apply(this, arguments).then(function(response) {
          try { postM3u8(response && response.url); } catch(_) {}
          return response;
        });
      };
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      try { postM3u8(url); } catch(_) {}
      this.addEventListener('load', function() {
        try { postM3u8(this.responseURL); } catch(_) {}
      });
      return originalOpen.apply(this, arguments);
    };

    const scanPerformanceEntries = function() {
      try {
        const entries = performance.getEntriesByType('resource') || [];
        for (const entry of entries) { postM3u8(entry && entry.name); }
      } catch(_) {}
    };

    try {
      const observer = new PerformanceObserver(function(list) {
        for (const entry of list.getEntries()) { postM3u8(entry && entry.name); }
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch(_) {}

    function findPlayButton() {
      try {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(function(b) {
          const p = b.querySelector('path');
          return p && p.getAttribute('d') === 'M8 5v14l11-7z';
        }) || null;
      } catch(_) { return null; }
    }

    function clickPosterOrPlay() {
      try {
        const poster = document.querySelector('div.fixed.inset-0.bg-black');
        if (poster) { poster.click(); return; }
      } catch(_) {}
      try {
        const play = findPlayButton();
        if (play) { play.click(); return; }
      } catch(_) {}
      try { document.body.click(); } catch(_) {}
    }

    function findSettingsButton() {
      try {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(function(b) {
          return b.querySelector('path[d*="M19.43 12.98"]');
        }) || null;
      } catch(_) { return null; }
    }

    function clickTabByName(name) {
      try {
        const target = String(name).toLowerCase();
        const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
        for (const tab of tabs) {
          const text = (tab.innerText || '').trim().toLowerCase();
          const controls = (tab.getAttribute('aria-controls') || '').toLowerCase();
          if (text === target || controls.includes(target)) { tab.click(); return true; }
        }
      } catch(_) {}
      return false;
    }

    function clickPreferredSource() {
      if (!preferredSource) return;
      try {
        const sourceName = String(preferredSource).toLowerCase();
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const button of buttons) {
          const gearPath = button.querySelector('path[d*="M19.43 12.98"]');
          if (gearPath) { button.click(); break; }
        }
        setTimeout(function() {
          const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
          for (const tab of tabs) {
            const text = (tab.innerText || '').trim().toLowerCase();
            const controls = (tab.getAttribute('aria-controls') || '').toLowerCase();
            if (text === 'servers' || controls.includes('servers')) { tab.click(); break; }
          }
        }, 250);
        setTimeout(function() {
          const serverPanel = document.querySelector('[role="tabpanel"][id*="Servers"]:not([hidden])') ||
            document.querySelector('[role="tabpanel"][aria-labelledby*="Servers"]:not([hidden])') || document;
          const candidates = Array.from(serverPanel.querySelectorAll('button'));
          for (const button of candidates) {
            const text = (button.innerText || '').toLowerCase();
            const primaryText = text.split('\\n')[0].trim();
            if (primaryText === sourceName || text.includes(sourceName)) {
              button.click(); sourceReady = true; return;
            }
          }
          sourceReady = true;
        }, 650);
      } catch(_) {}
    }

    function clickPreferredQuality() {
      if (!preferredQuality) return;
      try {
        const settings = findSettingsButton();
        if (settings) settings.click();
        setTimeout(function() { clickTabByName('quality'); }, 200);
        setTimeout(function() {
          const qualityName = String(preferredQuality).toLowerCase();
          const qualityPanel = document.querySelector('[role="tabpanel"][id*="Quality"]:not([hidden])') ||
            document.querySelector('[role="tabpanel"][aria-labelledby*="Quality"]:not([hidden])') || document;
          const candidates = Array.from(qualityPanel.querySelectorAll('button'));
          for (const button of candidates) {
            const text = (button.innerText || '').toLowerCase();
            const primaryText = text.split('\\n')[0].trim();
            if (primaryText === qualityName || text.includes(qualityName)) {
              button.click(); qualityReady = true; return;
            }
          }
          qualityReady = true;
        }, 500);
      } catch(_) { qualityReady = true; }
    }

    scanPerformanceEntries();
    setInterval(scanPerformanceEntries, 250);
    setTimeout(clickPosterOrPlay, 250);
    setTimeout(clickPosterOrPlay, 1000);
    setTimeout(clickPreferredSource, 1300);
    setTimeout(clickPreferredQuality, preferredSource ? 2300 : 1300);
    setTimeout(clickPosterOrPlay, 3200);
  })();`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomPlayer({
  title,
  streamUrl,
  tmdbId,
  tmdbType,
  seasonsLabel,
  totalSeasons,
  totalEpisodes,
  seasons: seasonsFromProps = [],
  thumbnailUrl,
  startPosition = 0,
  onProgress,
}: CustomPlayerProps) {
  const isTv = tmdbType === "tv";

  // Derive initial season/episode from the URL when it already encodes it
  const initialEpisode = syncEpisodeFromUrl(streamUrl);

  const [currentSeason, setCurrentSeason] = useState(initialEpisode?.season ?? 1);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode?.episode ?? 1);
  const [currentStreamUrl, setCurrentStreamUrl] = useState(streamUrl);
  const [selectedSource, setSelectedSource] = useState("Auto");
  const [selectedQualityUrl, setSelectedQualityUrl] = useState<string | null>(null);
  const [selectedQualityLabel, setSelectedQualityLabel] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<StreamQuality[]>([]);
  const [resolvedM3u8, setResolvedM3u8] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const resolveTokenRef = useRef(0);
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef(0);
  const lastDurationRef = useRef(0);
  const pendingStartRef = useRef(startPosition);

  // -------------------------------------------------------------------------
  // Season/episode helpers
  // -------------------------------------------------------------------------

  const apiSeasonCount = (() => {
    if (totalSeasons && totalSeasons > 0) return totalSeasons;
    if (seasonsFromProps.length > 0) return seasonsFromProps.length;
    if (seasonsLabel) {
      const m = /\d+/.exec(seasonsLabel);
      return m ? parseInt(m[0], 10) : 1;
    }
    return 1;
  })();

  const seasons: CatalogSeason[] =
    seasonsFromProps.length > 0
      ? seasonsFromProps
      : Array.from({ length: apiSeasonCount }, (_, i) => {
          const n = i + 1;
          return {
            seasonNumber: n,
            episodeCount: distributedEpisodeCount(n, apiSeasonCount, totalEpisodes),
          };
        });

  const episodeCountForSeason = useCallback(
    (season: number) => {
      const found = seasons.find((s) => s.seasonNumber === season);
      return found ? found.episodeCount : 1;
    },
    [seasons]
  );

  const seasonLabel = (s: CatalogSeason) =>
    s.name ?? (s.seasonNumber === 0 ? "Specials" : `Season ${s.seasonNumber}`);

  // -------------------------------------------------------------------------
  // Progress helpers
  // -------------------------------------------------------------------------

  const saveProgress = useCallback(() => {
    const pos = lastPositionRef.current;
    const dur = lastDurationRef.current;
    if (pos < 10 || dur <= 0) return;
    onProgress?.({ positionSeconds: pos, durationSeconds: dur });

    const storageKey = isTv
      ? `continue:tv:${tmdbId}`
      : `continue:movie:${tmdbId}`;
    try {
      const existing = window.localStorage.getItem(storageKey);
      const parsed = existing ? JSON.parse(existing) : {};
      const progress = Math.min(100, Math.round((pos / dur) * 100));
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...parsed,
          timestamp: Math.floor(pos),
          duration: Math.floor(dur),
          progress,
          updatedAt: new Date().toISOString(),
          ...(isTv
            ? { seasonNumber: currentSeason, episodeNumber: currentEpisode }
            : {}),
        })
      );
    } catch {
      // ignore
    }
  }, [tmdbId, isTv, currentSeason, currentEpisode, onProgress]);

  // -------------------------------------------------------------------------
  // HLS playback
  // -------------------------------------------------------------------------

  const loadHls = useCallback(
    (m3u8: string, resumeAt: number) => {
      const video = videoRef.current;
      if (!video) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({ startPosition: resumeAt > 0 ? resumeAt : -1 });
        hlsRef.current = hls;
        hls.loadSource(m3u8);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = m3u8;
        if (resumeAt > 0) {
          video.addEventListener(
            "loadedmetadata",
            () => {
              video.currentTime = resumeAt;
            },
            { once: true }
          );
        }
        video.play().catch(() => {});
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Quality resolution
  // -------------------------------------------------------------------------

  const selectQualityAndPlay = useCallback(
    async (masterM3u8: string, resumeAt: number) => {
      try {
        const res = await fetch(masterM3u8, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Origin: "https://player.videasy.net",
            Referer: "https://player.videasy.net/",
          },
        });
        const text = await res.text();
        if (!text.trimStart().startsWith("#EXTM3U")) {
          loadHls(masterM3u8, resumeAt);
          return;
        }
        const qualities = parseStreamQualities(text, masterM3u8);
        if (qualities.length === 0) {
          setAvailableQualities([]);
          loadHls(masterM3u8, resumeAt);
          return;
        }

        setAvailableQualities(qualities);

        // Pick quality by previously selected label, then by URL, then highest bandwidth
        let effectiveQuality =
          (selectedQualityUrl
            ? qualities.find((q) => q.url === selectedQualityUrl)
            : null) ??
          (selectedQualityLabel
            ? qualities.find((q) => q.label === selectedQualityLabel)
            : null) ??
          qualities[0];

        setSelectedQualityUrl(effectiveQuality.url);
        setSelectedQualityLabel(effectiveQuality.label);
        setResolvedM3u8(effectiveQuality.url);
        loadHls(effectiveQuality.url, resumeAt);
      } catch {
        setAvailableQualities([]);
        loadHls(masterM3u8, resumeAt);
      }
    },
    [selectedQualityUrl, selectedQualityLabel, loadHls]
  );

  // -------------------------------------------------------------------------
  // iframe capture
  // -------------------------------------------------------------------------

  const startResolve = useCallback(() => {
    const token = ++resolveTokenRef.current;
    setIsResolving(true);
    setPlaybackError(null);
    setResolvedM3u8(null);

    if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current);
    resolveTimeoutRef.current = setTimeout(() => {
      if (resolveTokenRef.current === token) {
        setIsResolving(false);
        setPlaybackError("Timed out waiting for a video stream.");
      }
    }, RESOLVE_TIMEOUT_MS);

    // Re-load the iframe by changing its key via a state-driven src change.
    // (We pass the token in the cache-buster so the browser re-fetches.)
    const preferredSource = selectedSource === "Auto" ? null : selectedSource;
    const url = withCacheBuster(normalizeVideasyUrl(currentStreamUrl));
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }

    return { token, preferredSource };
  }, [currentStreamUrl, selectedSource]);

  // -------------------------------------------------------------------------
  // postMessage listener
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "__impactstream_m3u8__") return;
      const { resolveToken: msgToken, url } = data;
      if (msgToken !== resolveTokenRef.current) return;
      if (!isM3u8Url(url)) return;

      if (resolveTimeoutRef.current) {
        clearTimeout(resolveTimeoutRef.current);
        resolveTimeoutRef.current = null;
      }

      setIsResolving(false);
      const resumeAt = pendingStartRef.current;
      pendingStartRef.current = 0;
      await selectQualityAndPlay(url, resumeAt);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [selectQualityAndPlay]);

  // -------------------------------------------------------------------------
  // iframe onload → inject capture script
  // -------------------------------------------------------------------------

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const preferredSource = selectedSource === "Auto" ? null : selectedSource;
    const script = buildCaptureScript(
      resolveTokenRef.current,
      preferredSource,
      selectedQualityLabel
    );
    try {
      (iframe.contentWindow as any)?.eval(script);
    } catch {
      // cross-origin eval may fail; the PerformanceObserver+fetch intercepts
      // won't work but we still get postMessage from same-origin fallback paths.
    }
  }, [selectedSource, selectedQualityLabel]);

  // -------------------------------------------------------------------------
  // Initial mount / stream URL change
  // -------------------------------------------------------------------------

  useEffect(() => {
    pendingStartRef.current = startPosition;
    startResolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStreamUrl]);

  // -------------------------------------------------------------------------
  // Progress polling
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.readyState < 2) return;
      lastPositionRef.current = video.currentTime;
      lastDurationRef.current = video.duration || 0;
      saveProgress();
    }, 5_000);
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [saveProgress]);

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      saveProgress();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Episode / source / quality changes
  // -------------------------------------------------------------------------

  const loadEpisode = (season: number, episode: number) => {
    saveProgress();
    const tmdbNumId = parseInt(tmdbId, 10);
    if (!isTv || !tmdbNumId || tmdbNumId <= 0) return;

    const seasons2 = seasons;
    const normSeason = seasons2.some((s) => s.seasonNumber === season)
      ? season
      : seasons2.find((s) => s.seasonNumber > 0)?.seasonNumber ??
        seasons2[0]?.seasonNumber ??
        1;
    const maxEpisode = episodeCountForSeason(normSeason);
    const normEpisode = Math.min(Math.max(1, episode), maxEpisode);

    setCurrentSeason(normSeason);
    setCurrentEpisode(normEpisode);
    setSelectedQualityUrl(null);
    setSelectedQualityLabel(null);
    setAvailableQualities([]);
    const url = `https://player.videasy.net/tv/${tmdbNumId}/${normSeason}/${normEpisode}?color=e50914&nextEpisode=true&episodeSelector=true&autoplayNextEpisode=true`;
    setCurrentStreamUrl(url);
  };

  const handleSourceChange = (source: string) => {
    if (source === selectedSource) return;
    setSelectedSource(source);
    setSelectedQualityUrl(null);
    setSelectedQualityLabel(null);
    setAvailableQualities([]);
    // Trigger re-resolve: useEffect on currentStreamUrl won't fire since the
    // URL hasn't changed; we bump the token manually.
    pendingStartRef.current = 0;
    const token = ++resolveTokenRef.current;
    setIsResolving(true);
    setPlaybackError(null);
    setResolvedM3u8(null);
    if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current);
    resolveTimeoutRef.current = setTimeout(() => {
      if (resolveTokenRef.current === token) {
        setIsResolving(false);
        setPlaybackError("Timed out waiting for a video stream.");
      }
    }, RESOLVE_TIMEOUT_MS);
    if (iframeRef.current) {
      iframeRef.current.src = withCacheBuster(normalizeVideasyUrl(currentStreamUrl));
    }
  };

  const handleQualityChange = async (qualityUrl: string | null) => {
    if (qualityUrl === selectedQualityUrl) return;
    const q = availableQualities.find((x) => x.url === qualityUrl) ?? null;
    setSelectedQualityUrl(qualityUrl);
    setSelectedQualityLabel(q?.label ?? null);
    if (qualityUrl) {
      setResolvedM3u8(qualityUrl);
      loadHls(qualityUrl, 0);
    }
  };

  const qualityDropdownValue = (() => {
    if (availableQualities.length === 0) return "auto";
    if (availableQualities.some((q) => q.url === selectedQualityUrl))
      return selectedQualityUrl!;
    if (selectedQualityLabel) {
      const found = availableQualities.find(
        (q) => q.label === selectedQualityLabel
      );
      if (found) return found.url;
    }
    return availableQualities[0].url;
  })();

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="custom-player">
      {/* Hidden resolver iframe */}
      <iframe
        ref={iframeRef}
        className="custom-player__resolver-iframe"
        src={withCacheBuster((() => {
          try { return normalizeVideasyUrl(currentStreamUrl); } catch { return "about:blank"; }
        })())}
        onLoad={handleIframeLoad}
        allow="autoplay; fullscreen"
        title="resolver"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Video element */}
      <div className="custom-player__video-wrap">
        <video
          ref={videoRef}
          className="custom-player__video"
          controls
          playsInline
          autoPlay
        />

        {/* Resolving overlay */}
        {isResolving && (
          <div className="custom-player__overlay custom-player__overlay--resolving">
            <div className="custom-player__spinner" />
            <span>Resolving stream…</span>
          </div>
        )}

        {/* Error overlay */}
        {!isResolving && playbackError && (
          <div className="custom-player__overlay custom-player__overlay--error">
            <svg
              className="custom-player__error-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="custom-player__error-title">
              Unable to resolve the video stream.
            </p>
            <p className="custom-player__error-detail">{playbackError}</p>
            <button
              className="custom-player__btn custom-player__btn--primary"
              onClick={() => {
                pendingStartRef.current = 0;
                setCurrentStreamUrl((u) => u); // trigger effect
                startResolve();
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="custom-player__controls">
        {isTv && (
          <>
            <button
              className="custom-player__btn"
              disabled={isResolving || currentEpisode <= 1}
              onClick={() =>
                loadEpisode(currentSeason, currentEpisode - 1)
              }
              title="Previous episode"
            >
              &#9198;
            </button>
            <button
              className="custom-player__btn"
              disabled={isResolving}
              onClick={() =>
                loadEpisode(currentSeason, currentEpisode + 1)
              }
              title="Next episode"
            >
              &#9197;
            </button>
          </>
        )}

        <button
          className="custom-player__btn"
          disabled={isResolving}
          onClick={() => setShowOptions((v) => !v)}
          title="Playback options"
        >
          &#8942; Options
        </button>
      </div>

      {/* Options panel */}
      {showOptions && (
        <div className="custom-player__options-panel">
          <div className="custom-player__options-header">
            <span>Playback options</span>
            <button
              className="custom-player__btn custom-player__btn--icon"
              onClick={() => setShowOptions(false)}
              aria-label="Close options"
            >
              &#x2715;
            </button>
          </div>

          {isTv && (
            <>
              <label className="custom-player__option-label">
                <span>Season</span>
                <select
                  value={currentSeason}
                  onChange={(e) => {
                    setShowOptions(false);
                    loadEpisode(Number(e.target.value), 1);
                  }}
                >
                  {(seasons.length > 0
                    ? seasons
                    : [{ seasonNumber: 1, episodeCount: 1 }]
                  ).map((s) => (
                    <option key={s.seasonNumber} value={s.seasonNumber}>
                      {seasonLabel(s)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="custom-player__option-label">
                <span>Episode</span>
                <select
                  value={currentEpisode}
                  onChange={(e) => {
                    setShowOptions(false);
                    loadEpisode(currentSeason, Number(e.target.value));
                  }}
                >
                  {Array.from(
                    { length: episodeCountForSeason(currentSeason) },
                    (_, i) => i + 1
                  ).map((ep) => (
                    <option key={ep} value={ep}>
                      Episode {ep}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="custom-player__option-label">
            <span>Source</span>
            <select
              value={selectedSource}
              onChange={(e) => {
                setShowOptions(false);
                handleSourceChange(e.target.value);
              }}
            >
              {SOURCE_OPTIONS.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </label>

          <label className="custom-player__option-label">
            <span>Quality</span>
            <select
              value={qualityDropdownValue}
              onChange={(e) => {
                setShowOptions(false);
                handleQualityChange(
                  e.target.value === "auto" ? null : e.target.value
                );
              }}
            >
              {availableQualities.length === 0 ? (
                <option value="auto">Auto</option>
              ) : (
                availableQualities.map((q) => (
                  <option key={q.url} value={q.url}>
                    {q.label}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
