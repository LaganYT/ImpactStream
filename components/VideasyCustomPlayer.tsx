import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { fetchVideasyDownloadData, type DownloadRequest } from "../utils/videasyDownloader";
import {
  VIDEOASY_SOURCE_UI_LABELS,
  type StreamQuality,
  type VideasySourceUiLabel,
  fetchPlaylistText,
  isM3u8Url,
  normalizeVideasyUrl,
  parseTvSeasonEpisodeFromUrl,
  pickSourceUrlByUiLabel,
  selectPlaybackQualityUrl,
  withResolutionCacheBuster,
} from "../lib/videasyPlayback";

export type VideasyCustomPlayerContinueConfig = {
  storageKey: string;
  indexEntry: string;
  mode: "movie" | "tv" | "animeMovie" | "animeTv";
  tmdbId: string;
  title: string;
  posterPath?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
};

type Props = {
  title: string;
  streamUrl: string;
  videasyRequest: DownloadRequest;
  continueWatching?: VideasyCustomPlayerContinueConfig | null;
  className?: string;
};

function readResumeSeconds(
  storageKey: string,
  seasonNumber?: number,
  episodeNumber?: number
): number {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as {
      timestamp?: number;
      seasonNumber?: number;
      episodeNumber?: number;
    };
    if (
      seasonNumber != null &&
      episodeNumber != null &&
      (Number(parsed?.seasonNumber) !== seasonNumber || Number(parsed?.episodeNumber) !== episodeNumber)
    ) {
      return 0;
    }
    const ts = Math.floor(Number(parsed?.timestamp || 0));
    return ts > 0 ? ts : 0;
  } catch {
    return 0;
  }
}

function touchContinueWatchingIndex(indexEntry: string) {
  try {
    const indexKey = "continueWatching:index";
    const indexRaw = window.localStorage.getItem(indexKey);
    const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
    const filtered = index.filter((e) => e !== indexEntry);
    filtered.unshift(indexEntry);
    window.localStorage.setItem(indexKey, JSON.stringify(filtered.slice(0, 50)));
  } catch {
    // ignore
  }
}

function saveContinueProgress(
  cfg: VideasyCustomPlayerContinueConfig,
  positionSeconds: number,
  durationSeconds: number
) {
  if (positionSeconds < 10 || durationSeconds <= 0) return;

  const progress = Math.max(0, Math.min(100, (positionSeconds / durationSeconds) * 100));
  const timestamp = Math.max(0, Math.floor(positionSeconds));
  const duration = Math.max(0, Math.floor(durationSeconds));
  const updatedAt = new Date().toISOString();

  try {
    const existing = window.localStorage.getItem(cfg.storageKey);
    const parsed = existing ? JSON.parse(existing) : {};

    if (cfg.mode === "movie" || cfg.mode === "animeMovie") {
      window.localStorage.setItem(
        cfg.storageKey,
        JSON.stringify({
          ...parsed,
          timestamp,
          duration,
          progress,
          updatedAt,
          title: cfg.title,
          posterPath: cfg.posterPath ?? parsed.posterPath,
          mediaType: cfg.mode === "animeMovie" ? "anime:movie" : "movie",
          tmdbId: cfg.tmdbId,
        })
      );
      touchContinueWatchingIndex(cfg.indexEntry);
      return;
    }

    const seasonNumber = cfg.seasonNumber ?? (Number(parsed.seasonNumber) || 1);
    const episodeNumber = cfg.episodeNumber ?? (Number(parsed.episodeNumber) || 1);

    window.localStorage.setItem(
      cfg.storageKey,
      JSON.stringify({
        ...parsed,
        seasonNumber,
        episodeNumber,
        timestamp,
        duration,
        progress,
        updatedAt,
        title: cfg.title,
        posterPath: cfg.posterPath ?? parsed.posterPath,
        mediaType: cfg.mode === "animeTv" ? "anime:tv" : "tv",
        tmdbId: cfg.tmdbId,
      })
    );
    touchContinueWatchingIndex(cfg.indexEntry);
  } catch {
    // ignore
  }
}

export default function VideasyCustomPlayer({
  title,
  streamUrl,
  videasyRequest,
  continueWatching,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSaveRef = useRef(0);
  const sourceResolveGen = useRef(0);
  const playbackGen = useRef(0);

  const [isResolving, setIsResolving] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [resolvedLabel, setResolvedLabel] = useState<string>("");
  const [masterBundle, setMasterBundle] = useState<{ url: string; playlist: string } | null>(null);

  const [selectedSource, setSelectedSource] = useState<VideasySourceUiLabel | string>("Auto");
  const [sourcesList, setSourcesList] = useState<{ url: string; quality?: string }[]>([]);
  const [selectedQualityUrl, setSelectedQualityUrl] = useState<string | null>(null);
  const [selectedQualityLabel, setSelectedQualityLabel] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<StreamQuality[]>([]);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = useMemo(() => JSON.stringify(videasyRequest), [videasyRequest]);

  const startPosition = useMemo(() => {
    if (!continueWatching) return 0;
    return readResumeSeconds(
      continueWatching.storageKey,
      continueWatching.seasonNumber,
      continueWatching.episodeNumber
    );
  }, [continueWatching]);

  const teardownHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      teardownHls();
    };
  }, [teardownHls]);

  // Resolve Videasy sources and master HLS playlist (client-side WASM + fetch).
  useEffect(() => {
    const gen = ++sourceResolveGen.current;
    setIsResolving(true);
    setPlaybackError(null);
    setMasterBundle(null);
    teardownHls();

    let cancelled = false;

    const run = async () => {
      try {
        const decoded = await fetchVideasyDownloadData(JSON.parse(requestKey) as DownloadRequest);
        if (cancelled || gen !== sourceResolveGen.current) return;

        const list = decoded.sources || [];
        setSourcesList(list);

        const picked = pickSourceUrlByUiLabel(list, selectedSource);
        if (!picked) {
          throw new Error("No stream sources returned.");
        }

        let masterUrl = picked;
        if (!isM3u8Url(picked)) {
          try {
            masterUrl = withResolutionCacheBuster(normalizeVideasyUrl(picked));
          } catch {
            throw new Error(
              "This source is not a direct HLS manifest. Use the site embed for this provider."
            );
          }
        }

        const playlistText = await fetchPlaylistText(masterUrl);
        if (cancelled || gen !== sourceResolveGen.current) return;

        const { qualities, effective } = selectPlaybackQualityUrl(
          masterUrl,
          playlistText,
          null,
          null
        );

        setAvailableQualities(qualities);
        setSelectedQualityUrl(effective?.url ?? null);
        setSelectedQualityLabel(effective?.label ?? null);

        const labelBits = [effective?.label, list[0]?.quality].filter(Boolean);
        setResolvedLabel(labelBits.join(" · ") || "Stream");

        setMasterBundle({ url: masterUrl, playlist: playlistText });
      } catch (e: unknown) {
        if (cancelled || gen !== sourceResolveGen.current) return;
        setIsResolving(false);
        setPlaybackError(e instanceof Error ? e.message : String(e));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [requestKey, reloadToken, streamUrl, selectedSource, teardownHls]);

  // Attach HLS to the selected variant (quality changes do not re-hit Videasy APIs).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !masterBundle) return;

    const gen = ++playbackGen.current;
    setIsResolving(true);
    setPlaybackError(null);
    teardownHls();

    let cancelled = false;
    const resumeAt = startPosition;

    try {
      const { playbackUrl } = selectPlaybackQualityUrl(
        masterBundle.url,
        masterBundle.playlist,
        selectedQualityUrl,
        selectedQualityLabel
      );

      if (!Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = playbackUrl;
        } else {
          throw new Error("HLS playback is not supported in this browser.");
        }
      } else {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.loadSource(playbackUrl);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setPlaybackError(data.type + (data.details ? `: ${data.details}` : ""));
          }
        });
      }

      const onLoaded = () => {
        if (cancelled || gen !== playbackGen.current) return;
        if (resumeAt > 0 && video.duration > 0 && resumeAt < video.duration - 5) {
          try {
            video.currentTime = resumeAt;
          } catch {
            // ignore
          }
        }
        video.removeEventListener("loadedmetadata", onLoaded);
      };
      video.addEventListener("loadedmetadata", onLoaded);

      if (cancelled || gen !== playbackGen.current) return;
      setIsResolving(false);
      void video.play().catch(() => {
        // autoplay may be blocked
      });
    } catch (e: unknown) {
      if (cancelled || gen !== playbackGen.current) return;
      setIsResolving(false);
      setPlaybackError(e instanceof Error ? e.message : String(e));
    }

    return () => {
      cancelled = true;
    };
  }, [
    masterBundle,
    selectedQualityUrl,
    selectedQualityLabel,
    startPosition,
    teardownHls,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    const cfg = continueWatching;
    if (!video || !cfg) return;

    const onTime = () => {
      const now = Date.now();
      if (now - lastSaveRef.current < 8000) return;
      lastSaveRef.current = now;
      const position = video.currentTime;
      const duration = video.duration;
      if (position > 0 && duration > 0) {
        saveContinueProgress(cfg, position, duration);
      }
    };

    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [continueWatching]);

  const qualityDropdownValue = useMemo(() => {
    if (!availableQualities.length) return "auto";
    if (selectedQualityUrl && availableQualities.some((q) => q.url === selectedQualityUrl)) {
      return selectedQualityUrl;
    }
    if (selectedQualityLabel) {
      const match = availableQualities.find((q) => q.label === selectedQualityLabel);
      if (match) return match.url;
    }
    return availableQualities[0].url;
  }, [availableQualities, selectedQualityUrl, selectedQualityLabel]);

  const handleChangeQuality = (value: string) => {
    if (value === "auto") {
      setSelectedQualityUrl(null);
      setSelectedQualityLabel(null);
    } else {
      const q = availableQualities.find((x) => x.url === value);
      setSelectedQualityUrl(value);
      setSelectedQualityLabel(q?.label ?? null);
    }
    setOptionsOpen(false);
  };

  const handleChangeSource = (value: string) => {
    setSelectedSource(value);
    setSelectedQualityUrl(null);
    setSelectedQualityLabel(null);
    setOptionsOpen(false);
  };

  const handleRetry = () => {
    setPlaybackError(null);
    setReloadToken((t) => t + 1);
  };

  const tvFromUrl = parseTvSeasonEpisodeFromUrl(streamUrl);

  return (
    <div className={`videasy-custom-player ${className}`.trim()}>
      <div className="videasy-custom-player__chrome">
        <span className="videasy-custom-player__title" title={title}>
          {title}
        </span>
        <div className="videasy-custom-player__chrome-actions">
          <button
            type="button"
            className="videasy-custom-player__icon-btn"
            disabled={isResolving}
            onClick={() => setOptionsOpen((o) => !o)}
            aria-expanded={optionsOpen}
          >
            Options
          </button>
        </div>
      </div>

      <div className="videasy-custom-player__stage">
        <video ref={videoRef} className="videasy-custom-player__video" controls playsInline />

        {isResolving ? (
          <div className="videasy-custom-player__overlay videasy-custom-player__overlay--loading">
            <div className="videasy-custom-player__spinner" />
            <p>Resolving stream…</p>
          </div>
        ) : null}

        {playbackError ? (
          <div className="videasy-custom-player__overlay videasy-custom-player__overlay--error">
            <p className="videasy-custom-player__error-title">Unable to play this stream.</p>
            <p className="videasy-custom-player__error-detail">{playbackError}</p>
            <button type="button" onClick={handleRetry}>
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {!playbackError && !isResolving ? (
        <p className="videasy-custom-player__meta">{resolvedLabel}</p>
      ) : null}

      {optionsOpen ? (
        <div className="videasy-custom-player__sheet-backdrop" role="presentation" onClick={() => setOptionsOpen(false)}>
          <div
            className="videasy-custom-player__sheet"
            role="dialog"
            aria-label="Playback options"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="videasy-custom-player__sheet-header">
              <h2>Playback options</h2>
              <button type="button" className="videasy-custom-player__sheet-close" onClick={() => setOptionsOpen(false)}>
                Close
              </button>
            </div>

            <label className="videasy-custom-player__field">
              <span>Source</span>
              <select value={selectedSource} onChange={(e) => handleChangeSource(e.target.value)}>
                {VIDEOASY_SOURCE_UI_LABELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {sourcesList.length ? (
              <p className="videasy-custom-player__hint">
                {sourcesList.length} decoded source{sourcesList.length === 1 ? "" : "s"} — labels match Videasy quality
                names when present.
              </p>
            ) : null}

            <label className="videasy-custom-player__field">
              <span>Quality (HLS variant)</span>
              <select
                value={qualityDropdownValue}
                onChange={(e) => handleChangeQuality(e.target.value)}
                disabled={!availableQualities.length}
              >
                {!availableQualities.length ? <option value="auto">Auto</option> : null}
                {availableQualities.map((q) => (
                  <option key={q.url} value={q.url}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>

            {tvFromUrl ? (
              <p className="videasy-custom-player__hint">
                Episode in URL: S{tvFromUrl.season}E{tvFromUrl.episode}. Use the season and episode selectors on the
                page to change episode; the player reloads automatically.
              </p>
            ) : null}

            <button type="button" className="videasy-custom-player__sheet-done" onClick={() => setOptionsOpen(false)}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
