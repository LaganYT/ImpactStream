import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/forest/index.css';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress } from 'react-icons/fa';

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
  onReady
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = videoRef.current;
    
    // Initialize Video.js player
    const player = videojs(videoElement, {
      controls: true,
      fluid: true,
      responsive: true,
      autoplay: autoPlay,
      muted: muted,
      liveui: true,
      liveTracker: {
        trackingThreshold: 0,
        liveTolerance: 15
      },
      html5: {
        hls: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: true
        }
      },
      sources: [{
        src: src,
        type: 'application/x-mpegURL'
      }]
    }, () => {
      playerRef.current = player;
      setIsLoading(false);
      onReady?.();

      // Add event listeners
      player.on('play', () => {
        setIsPlaying(true);
        onPlay?.();
      });

      player.on('pause', () => {
        setIsPlaying(false);
        onPause?.();
      });

      player.on('error', (error: any) => {
        setHasError(true);
        setIsLoading(false);
        const errorMsg = error?.message || 'Failed to load stream';
        setErrorMessage(errorMsg);
        onError?.(errorMsg);
      });

      player.on('loadeddata', () => {
        setIsLoading(false);
      });

      // Custom controls
      const controlBar = player.getChild('ControlBar');
      if (controlBar) {
        // Add custom fullscreen button
        const fullscreenButton = controlBar.addChild('Button', {
          text: 'Fullscreen',
          className: 'vjs-fullscreen-button'
        });

        fullscreenButton.on('click', () => {
          if (player.isFullscreen()) {
            player.exitFullscreen();
            setIsFullscreen(false);
          } else {
            player.requestFullscreen();
            setIsFullscreen(true);
          }
        });
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, autoPlay, muted, onPlay, onPause, onError, onReady]);

  const handlePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    }
  };

  const handleMute = () => {
    if (playerRef.current) {
      const newMutedState = !isMuted;
      playerRef.current.muted(newMutedState);
      setIsMuted(newMutedState);
    }
  };

  const handleFullscreen = () => {
    if (playerRef.current) {
      if (isFullscreen) {
        playerRef.current.exitFullscreen();
        setIsFullscreen(false);
      } else {
        playerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    
    if (playerRef.current) {
      playerRef.current.src({
        src: src,
        type: 'application/x-mpegURL'
      });
      playerRef.current.load();
      playerRef.current.play().catch(() => {
        // Handle play error
      });
    }
  };

  const handleOpenInNewTab = () => {
    window.open(src, '_blank');
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
          <div className="loading-spinner"></div>
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
            <button onClick={handleOpenInNewTab} className="open-tab-button">
              Open in New Tab
            </button>
          </div>
          <div className="error-help">
            <p><strong>If the stream doesn't work:</strong></p>
            <ul>
              <li>Try refreshing the page</li>
              <li>Check your internet connection</li>
              <li>The stream might be temporarily unavailable</li>
              <li>Some streams may be geo-blocked in your region</li>
            </ul>
          </div>
        </div>
      )}

      {/* Custom overlay controls */}
      <div className="custom-controls">
        <button onClick={handlePlayPause} className="control-button">
          {isPlaying ? <FaPause /> : <FaPlay />}
        </button>
        <button onClick={handleMute} className="control-button">
          {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
        </button>
        <button onClick={handleFullscreen} className="control-button">
          {isFullscreen ? <FaCompress /> : <FaExpand />}
        </button>
      </div>
    </div>
  );
};

export default VideoJSPlayer;
