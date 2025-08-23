import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress, FaClosedCaptioning } from 'react-icons/fa';

interface HLSPlayerProps {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function HLSPlayer({
  src,
  autoPlay = false,
  muted = false,
  onPlay,
  onPause,
  onError,
  className = ''
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initPlayer = async () => {
      try {
        setLoading(true);
        setError(null);

        // Destroy existing HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        // Check if HLS is supported
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2,
            nudgeOffset: 0.2,
            nudgeMaxRetry: 5,
            maxFragLookUpTolerance: 0.25,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            liveDurationInfinity: true,
            liveBackBufferLength: 90,
            progressive: false,
            debug: false,
          });

          hlsRef.current = hls;

          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setLoading(false);
            if (autoPlay) {
              video.play().catch((e) => {
                console.warn('Auto-play failed:', e);
                setLoading(false);
              });
            }
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error('Network error:', data);
                  setError('Network error. Please check your connection.');
                  onError?.('Network error. Please check your connection.');
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error('Media error:', data);
                  setError('Media error. Stream may be unavailable.');
                  onError?.('Media error. Stream may be unavailable.');
                  break;
                default:
                  console.error('Fatal error:', data);
                  setError('Playback error. Please try again.');
                  onError?.('Playback error. Please try again.');
                  break;
              }
            }
          });

          hls.on(Hls.Events.BUFFER_APPENDING, () => {
            setLoading(false);
          });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          video.src = src;
          video.addEventListener('loadedmetadata', () => {
            setLoading(false);
            if (autoPlay) {
              video.play().catch((e) => {
                console.warn('Auto-play failed:', e);
                setLoading(false);
              });
            }
          });
        } else {
          throw new Error('HLS is not supported in this browser');
        }

        // Set up video event listeners
        video.addEventListener('play', () => {
          setIsPlaying(true);
          onPlay?.();
        });

        video.addEventListener('pause', () => {
          setIsPlaying(false);
          onPause?.();
        });

        video.addEventListener('waiting', () => {
          setLoading(true);
        });

        video.addEventListener('canplay', () => {
          setLoading(false);
        });

        video.addEventListener('timeupdate', () => {
          setCurrentTime(video.currentTime);
        });

        video.addEventListener('loadedmetadata', () => {
          setDuration(video.duration);
        });

        video.addEventListener('volumechange', () => {
          setVolume(video.volume);
          setIsMuted(video.muted);
        });

        video.addEventListener('error', (e) => {
          console.error('Video error:', e);
          setError('Video playback error');
          onError?.('Video playback error');
        });

        // Set initial muted state
        video.muted = muted;

      } catch (err) {
        console.error('Failed to initialize HLS player:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stream');
        onError?.(err instanceof Error ? err.message : 'Failed to load stream');
        setLoading(false);
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay, muted, onPlay, onPause, onError]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((e) => {
        console.error('Failed to play:', e);
      });
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    
    if (newVolume === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number): string => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    // Hide controls after 3 seconds of inactivity
    setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
    }
  };

  return (
    <div 
      className={`hls-player-container ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        className="hls-video"
        playsInline
        muted={muted}
      />
      
      {loading && (
        <div className="hls-loading">
          <div className="loading-spinner"></div>
          <p>Loading stream...</p>
        </div>
      )}

      {error && (
        <div className="hls-error">
          <h3>Playback Error</h3>
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Center Play Button Overlay */}
      {!loading && !error && !isPlaying && (
        <div className="center-play-button" onClick={togglePlayPause}>
          <div className="play-icon">
            <FaPlay />
          </div>
        </div>
      )}

      {showControls && !error && (
        <div className="hls-controls">
          {/* Progress Bar */}
          <div className="progress-container">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="progress-bar"
            />
          </div>

          {/* Controls Bar */}
          <div className="controls-bar">
            <div className="left-controls">
              <button onClick={togglePlayPause} className="control-button">
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
              
              <div className="volume-control">
                <button 
                  onClick={toggleMute} 
                  className="control-button"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  {isMuted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
                </button>
                {showVolumeSlider && (
                  <div className="volume-slider-container">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="volume-slider"
                    />
                  </div>
                )}
              </div>

              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                {duration > 0 && <span> / {formatTime(duration)}</span>}
              </div>
            </div>

            <div className="right-controls">
              <button className="control-button">
                <FaClosedCaptioning />
              </button>
              <button onClick={toggleFullscreen} className="control-button">
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
