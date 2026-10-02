import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaListUl, FaPlay, FaRedo, FaStepForward, FaTimes } from "react-icons/fa";
import EpisodeList, { EpisodeInfo } from "./EpisodeList";
import MediaDetailShell from "./MediaDetailShell";
import { EpisodeRef, useMediaPlayback } from "../hooks/useMediaPlayback";
import type { ContinueMediaType } from "../utils/continueWatching";
import { tmdbFetch } from "../utils/tmdbClient";

const AUTO_NEXT_KEY = "playback:autoNext";
const UP_NEXT_SECONDS = 10;
// Below this, starting over is no different from resuming.
const MIN_RESUME_PROMPT_SECONDS = 30;

const firstQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const toPositiveNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function formatTimestamp(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const paddedSeconds = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}

const episodeLabel = ({ season, episode }: EpisodeRef) => `S${season} E${episode}`;

export default function WatchPage({ mediaType }: { mediaType: ContinueMediaType }) {
  const router = useRouter();
  const tmdbId = firstQueryValue(router.query.id);

  // Remount per title so playback state never leaks between shows.
  return <WatchView key={`${mediaType}:${tmdbId}`} mediaType={mediaType} tmdbId={tmdbId} />;
}

function WatchView({ mediaType, tmdbId }: { mediaType: ContinueMediaType; tmdbId?: string }) {
  const router = useRouter();
  const playback = useMediaPlayback({
    tmdbId,
    mediaType,
    initialSeason: toPositiveNumber(firstQueryValue(router.query.season)),
    initialEpisode: toPositiveNumber(firstQueryValue(router.query.episode)),
  });

  const [resumeChoice, setResumeChoice] = useState<"pending" | "resume" | "restart">("pending");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const autoNextRef = useRef(autoNext);
  autoNextRef.current = autoNext;

  useEffect(() => {
    setAutoNext(window.localStorage.getItem(AUTO_NEXT_KEY) !== "false");
  }, []);

  const toggleAutoNext = () => {
    const nextValue = !autoNext;
    setAutoNext(nextValue);
    window.localStorage.setItem(AUTO_NEXT_KEY, String(nextValue));
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const playEpisode = (ref: EpisodeRef) => {
    // Choosing an episode is an explicit choice, so skip the resume prompt.
    setResumeChoice("resume");
    setIsDrawerOpen(false);
    playback.selectEpisode(ref);
  };

  const startAt = resumeChoice === "restart" ? 0 : playback.resumeSeconds;
  const { buildEmbedUrl } = playback;
  // Only rebuilt when a new episode loads; toggling autoplay mid-episode takes
  // effect from the next episode instead of reloading the player.
  const embedUrl = useMemo(
    () => buildEmbedUrl(startAt, autoNextRef.current),
    [buildEmbedUrl, startAt]
  );

  if (!playback.isReady) return <div className="loading">Loading...</div>;

  const needsResumePrompt =
    resumeChoice === "pending" && playback.resumeSeconds >= MIN_RESUME_PROMPT_SECONDS;
  const episodeName = playback.currentEpisodeInfo?.name;

  return (
    <div className="watch-layout">
      <header className="watch-bar">
        <button className="watch-bar-button" onClick={goBack} aria-label="Go back">
          <FaArrowLeft />
        </button>
        <div className="watch-bar-title">
          <h1>{playback.title}</h1>
          {playback.isEpisodic ? (
            <p>
              {episodeLabel(playback.current)}
              {episodeName ? ` · ${episodeName}` : ""}
            </p>
          ) : null}
        </div>
        {playback.isEpisodic ? (
          <div className="watch-bar-actions">
            <label className="watch-autonext">
              <input type="checkbox" checked={autoNext} onChange={toggleAutoNext} />
              Autoplay next
            </label>
            <button
              className="watch-bar-button with-label"
              onClick={() => setIsDrawerOpen((open) => !open)}
              aria-expanded={isDrawerOpen}
            >
              <FaListUl /> Episodes
            </button>
            {playback.nextEpisode ? (
              <button
                className="watch-bar-button with-label"
                onClick={() => playEpisode(playback.nextEpisode!)}
                title={`Play ${episodeLabel(playback.nextEpisode)}`}
              >
                <FaStepForward /> Next
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="watch-stage">
        {needsResumePrompt ? (
          <div className="resume-prompt" role="dialog" aria-label="Resume playback">
            <h2>Welcome back</h2>
            <p>
              {playback.isEpisodic ? `${episodeLabel(playback.loaded)} · ` : ""}
              You stopped at {formatTimestamp(playback.resumeSeconds)}.
            </p>
            <div className="resume-actions">
              <button className="btn-play" onClick={() => setResumeChoice("resume")} autoFocus>
                <FaPlay /> Resume from {formatTimestamp(playback.resumeSeconds)}
              </button>
              <button className="btn-more-info" onClick={() => setResumeChoice("restart")}>
                <FaRedo /> Start over
              </button>
            </div>
          </div>
        ) : (
          <MediaDetailShell title={playback.title} embedUrl={embedUrl} />
        )}

        {playback.showUpNext && playback.nextEpisode ? (
          <UpNextCard
            next={playback.nextEpisode}
            autoNext={autoNext}
            onPlay={() => playEpisode(playback.nextEpisode!)}
            onDismiss={playback.dismissUpNext}
          />
        ) : null}

        {isDrawerOpen && tmdbId ? (
          <EpisodeDrawer
            tmdbId={tmdbId}
            seasons={playback.seasonNumbers}
            current={playback.current}
            onSelect={playEpisode}
            onClose={() => setIsDrawerOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

function UpNextCard({
  next,
  autoNext,
  onPlay,
  onDismiss,
}: {
  next: EpisodeRef;
  autoNext: boolean;
  onPlay: () => void;
  onDismiss: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(UP_NEXT_SECONDS);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  useEffect(() => {
    if (!autoNext) return;
    if (secondsLeft <= 0) {
      onPlayRef.current();
      return;
    }
    const timeout = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [autoNext, secondsLeft]);

  return (
    <div className="up-next-card" role="status">
      <span className="up-next-kicker">Up next</span>
      <strong>{episodeLabel(next)}</strong>
      <div className="up-next-actions">
        <button className="btn-play" onClick={onPlay}>
          <FaPlay /> {autoNext ? `Play in ${secondsLeft}s` : "Play now"}
        </button>
        <button className="btn-more-info" onClick={onDismiss} aria-label="Dismiss up next">
          <FaTimes />
        </button>
      </div>
    </div>
  );
}

function EpisodeDrawer({
  tmdbId,
  seasons,
  current,
  onSelect,
  onClose,
}: {
  tmdbId: string;
  seasons: number[];
  current: EpisodeRef;
  onSelect: (ref: EpisodeRef) => void;
  onClose: () => void;
}) {
  const [season, setSeason] = useState(current.season);
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEpisodes(null);
    tmdbFetch<{ episodes?: EpisodeInfo[] }>(`tv/${tmdbId}/season/${season}`)
      .then((data) => {
        if (!cancelled) setEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
      })
      .catch(() => {
        if (!cancelled) setEpisodes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbId, season]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside className="episode-drawer" aria-label="Episodes">
      <button className="tm-close" onClick={onClose} aria-label="Close episodes">
        <FaTimes />
      </button>
      {episodes === null ? (
        <div className="tm-loading">Loading</div>
      ) : (
        <EpisodeList
          episodes={episodes}
          seasons={seasons}
          season={season}
          activeEpisode={season === current.season ? current.episode : undefined}
          onSeasonChange={setSeason}
          onEpisodeSelect={(episode) => onSelect({ season, episode })}
        />
      )}
    </aside>
  );
}
