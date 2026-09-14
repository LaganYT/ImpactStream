import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { FaArrowLeft } from "react-icons/fa";
import LiveStreamPlayer from "../../components/LiveStreamPlayer";

interface Channel {
  nanoid: string;
  name: string;
  iptv_urls: string[];
  youtube_urls: string[];
  language: string;
  country: string;
  isGeoBlocked: boolean;
}

type GuideProgram = {
  title: string;
  description: string;
  start: string;
  stop: string;
  category: string;
};

type GuideSource = {
  feed: string | null;
  site: string;
  siteId: string;
  siteName: string;
  language: string;
  hasSource: boolean;
};

type ChannelGuide = {
  guides: GuideSource[];
  programs: GuideProgram[];
};

function getPlayableStreamUrl(url: string) {
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("http://")) {
    return `/api/stream-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
}

export default function LiveTvChannelPage() {
  const router = useRouter();
  const { id } = router.query;
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [guide, setGuide] = useState<ChannelGuide | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchChannel = async () => {
      try {
        setLoading(true);
        const response = await axios.get<Channel[]>("/api/live-tv");
        const routeId = Array.isArray(id) ? id[0] : id;
        const selectedChannel = response.data.find((item) => item.nanoid === routeId);

        if (!selectedChannel) {
          setError("Channel not found");
          return;
        }

        setChannel(selectedChannel);
        if (selectedChannel.iptv_urls.length > 0) {
          setStreamUrl(getPlayableStreamUrl(selectedChannel.iptv_urls[0]));
        } else if (selectedChannel.youtube_urls.length > 0) {
          setStreamUrl(selectedChannel.youtube_urls[0]);
        }
      } catch (requestError) {
        console.error("Error fetching channel:", requestError);
        setError("Failed to load channel");
      } finally {
        setLoading(false);
      }
    };

    fetchChannel();
  }, [id]);

  useEffect(() => {
    if (!channel?.nanoid) return;

    const fetchGuide = async () => {
      try {
        setGuideLoading(true);
        const response = await axios.get(
          `/api/live-tv-guide?channel=${encodeURIComponent(channel.nanoid)}`
        );
        setGuide(response.data);
      } catch (requestError) {
        console.error("Error fetching guide:", requestError);
        setGuide(null);
      } finally {
        setGuideLoading(false);
      }
    };

    fetchGuide();
  }, [channel?.nanoid]);

  const goBack = () => router.push("/live-tv");

  const formatGuideTime = (value: string) => {
    if (!value) return "";

    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  };

  const getProgramWidth = (program: GuideProgram) => {
    const startTime = new Date(program.start).getTime();
    const stopTime = new Date(program.stop).getTime();
    const durationMinutes = (stopTime - startTime) / 60000;
    const validDuration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30;
    return Math.max(150, Math.min(260, validDuration * 2.2));
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
          <button onClick={goBack} className="back-button">
            <FaArrowLeft /> Back to Live TV
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-player-container">
      <div className="player-header">
        <button onClick={goBack} className="back-button">
          <FaArrowLeft /> Back
        </button>
        <h1>{channel.name}</h1>
        <div className="channel-info">
          {channel.language ? <span className="language">{channel.language.toUpperCase()}</span> : null}
          {channel.country ? <span className="country">{channel.country.toUpperCase()}</span> : null}
        </div>
      </div>

      <div className="video-container">
        {channel.iptv_urls.length > 0 ? (
          <LiveStreamPlayer
            src={streamUrl}
            channelName={channel.name}
            autoPlay
            onError={setError}
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
            <button onClick={goBack} className="back-button">
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
          {channel.language ? (
            <div className="detail-item">
              <strong>Language:</strong> {channel.language.toUpperCase()}
            </div>
          ) : null}
          {channel.country ? (
            <div className="detail-item">
              <strong>Country:</strong> {channel.country.toUpperCase()}
            </div>
          ) : null}
          <div className="detail-item">
            <strong>Stream Type:</strong> {channel.iptv_urls.length > 0 ? "IPTV" : "YouTube"}
          </div>
          <div className="detail-item">
            <strong>Geo-blocked:</strong> {channel.isGeoBlocked ? "Yes" : "No"}
          </div>
        </div>
      </div>

      <div className="channel-details">
        <h2>Channel Guide</h2>
        {guideLoading ? (
          <div className="loading">Loading guide...</div>
        ) : guide?.programs.length ? (
          <div className="guide-timeline" aria-label={`${channel.name} schedule`}>
            {guide.programs.map((program, index) => (
              <div
                className="guide-slot"
                key={`${program.start}-${program.title}-${index}`}
                style={{ minWidth: `${getProgramWidth(program)}px` }}
              >
                <div className="guide-slot-time">
                  {formatGuideTime(program.start)}
                  {program.stop ? ` - ${formatGuideTime(program.stop)}` : ""}
                </div>
                <div className="guide-slot-title">{program.title}</div>
                {program.category ? <div className="guide-slot-meta">{program.category}</div> : null}
                {program.description ? <p>{program.description}</p> : null}
              </div>
            ))}
          </div>
        ) : guide?.guides.length ? (
          <p>No programme schedule is available for this channel right now.</p>
        ) : (
          <p>No guide data is available for this channel.</p>
        )}
      </div>
    </div>
  );
}
