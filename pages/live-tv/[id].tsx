import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { FaArrowLeft } from "react-icons/fa";
import HLSPlayer from "../../components/HLSPlayer";

interface Channel {
  nanoid: string;
  name: string;
  iptv_urls: string[];
  youtube_urls: string[];
  language: string;
  country: string;
  isGeoBlocked: boolean;
}

export default function TVPlayer() {
  const router = useRouter();
  const { id } = router.query;
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");

  useEffect(() => {
    if (id) {
      fetchChannel();
    }
  }, [id]);

  const fetchChannel = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/live-tv');
      const channels = response.data;
      const foundChannel = channels.find((ch: Channel) => ch.nanoid === id);
      
      if (foundChannel) {
        setChannel(foundChannel);
        // Prefer IPTV URL over YouTube URL
        if (foundChannel.iptv_urls.length > 0) {
          setStreamUrl(foundChannel.iptv_urls[0]);
        } else if (foundChannel.youtube_urls.length > 0) {
          setStreamUrl(foundChannel.youtube_urls[0]);
        }
      } else {
        setError("Channel not found");
      }
    } catch (err) {
      setError("Failed to load channel");
      console.error('Error fetching channel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/live-tv');
  };

  if (loading) {
    return (
      <div className="tv-player-container">
        <div className="loading">Loading channel...</div>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="tv-player-container">
        <div className="error">
          <h2>Error</h2>
          <p>{error || "Channel not found"}</p>
          <button onClick={handleBack} className="back-button">
            <FaArrowLeft /> Back to Live TV
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-player-container">
      <div className="player-header">
        <button onClick={handleBack} className="back-button">
          <FaArrowLeft /> Back
        </button>
        <h1>{channel.name}</h1>
        <div className="channel-info">
          {channel.language && <span className="language">{channel.language.toUpperCase()}</span>}
          {channel.country && <span className="country">{channel.country.toUpperCase()}</span>}
        </div>
      </div>

      <div className="video-container">
        {channel.iptv_urls.length > 0 ? (
          <HLSPlayer
            src={streamUrl}
            autoPlay={true}
            muted={isMuted}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(error) => setError(error)}
            className="video-player"
          />
        ) : channel.youtube_urls.length > 0 ? (
          <iframe
            className="video-player"
            src={streamUrl}
            title={channel.name}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="no-stream">
            <p>No stream available for this channel</p>
            <button onClick={handleBack} className="back-button">
              <FaArrowLeft /> Back to Live TV
            </button>
          </div>
        )}
      </div>

      <div className="channel-details">
        <h2>Channel Information</h2>
        <div className="details-grid">
          <div className="detail-item">
            <strong>Name:</strong> {channel.name}
          </div>
          {channel.language && (
            <div className="detail-item">
              <strong>Language:</strong> {channel.language.toUpperCase()}
            </div>
          )}
          {channel.country && (
            <div className="detail-item">
              <strong>Country:</strong> {channel.country.toUpperCase()}
            </div>
          )}
          <div className="detail-item">
            <strong>Stream Type:</strong> {channel.iptv_urls.length > 0 ? "IPTV" : "YouTube"}
          </div>
          <div className="detail-item">
            <strong>Geo-blocked:</strong> {channel.isGeoBlocked ? "Yes" : "No"}
          </div>
        </div>
      </div>
    </div>
  );
}
