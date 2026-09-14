import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/forest/index.css";

interface VideoJSPlayerProps {
  src: string;
  channelName: string;
  autoPlay?: boolean;
  muted?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

const VideoJSPlayer: React.FC<VideoJSPlayerProps> = ({
  src,
  channelName,
  autoPlay = true,
  muted = false,
  onPlay,
  onPause,
  onError,
  onReady,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!videoRef.current) return;

    const player = videojs(
      videoRef.current,
      {
        controls: true,
        fluid: true,
        responsive: true,
        autoplay: autoPlay,
        muted,
        liveui: true,
        liveTracker: {
          trackingThreshold: 0,
          liveTolerance: 15,
        },
        html5: {
          hls: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: true,
          },
        },
        sources: [
          {
            src,
            type: "application/x-mpegURL",
          },
        ],
      },
      () => {
        playerRef.current = player;
        setIsLoading(false);
        onReady?.();

        player.on("play", () => onPlay?.());
        player.on("pause", () => onPause?.());
        player.on("error", (error: any) => {
          setHasError(true);
          setIsLoading(false);
          const message = error?.message || "Failed to load stream";
          setErrorMessage(message);
          onError?.(message);
        });
        player.on("loadeddata", () => setIsLoading(false));
      }
    );

    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, [src, autoPlay, muted, onPlay, onPause, onError, onReady]);

  const handleRetry = () => {
    setHasError(false);
    setErrorMessage("");
    setIsLoading(true);

    if (playerRef.current) {
      playerRef.current.src({
        src,
        type: "application/x-mpegURL",
      });
      playerRef.current.load();
      playerRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="videojs-container">
      <div data-vjs-player>
        <video
          ref={videoRef}
          className="video-js vjs-theme-forest vjs-big-play-centered"
          data-setup="{}"
        >
          <p className="vjs-no-js">
            To view this video please enable JavaScript, and consider upgrading to a
            web browser that supports HTML5 video.
          </p>
        </video>
      </div>

      {isLoading && (
        <div className="videojs-loading">
          <div className="loading-spinner" />
          <p>Loading {channelName}...</p>
          <p className="loading-note">This may take a few moments for live streams</p>
        </div>
      )}

      {hasError && (
        <div className="videojs-error">
          <h3>Stream Error</h3>
          <p>{errorMessage}</p>
          <div className="error-actions">
            <button onClick={handleRetry} className="retry-button">
              Retry Stream
            </button>
            <button
              onClick={() => window.open(src, "_blank")}
              className="open-tab-button"
            >
              Open in New Tab
            </button>
          </div>
          <div className="error-help">
            <p>
              <strong>If the stream doesn't work:</strong>
            </p>
            <ul>
              <li>Try refreshing the page</li>
              <li>Check your internet connection</li>
              <li>The stream might be temporarily unavailable</li>
              <li>Some streams may be geo-blocked in your region</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoJSPlayer;
