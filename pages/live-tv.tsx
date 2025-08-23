import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { FaPlay, FaGlobe, FaYoutube } from "react-icons/fa";

interface Channel {
  nanoid: string;
  name: string;
  iptv_urls: string[];
  youtube_urls: string[];
  language: string;
  country: string;
  isGeoBlocked: boolean;
}

export default function LiveTV() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await axios.get('/api/live-tv');
        setChannels(response.data);
      } catch (error) {
        console.error('Error fetching channels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLanguage = !selectedLanguage || channel.language === selectedLanguage;
    const matchesCountry = !selectedCountry || channel.country === selectedCountry;
    return matchesSearch && matchesLanguage && matchesCountry;
  });

  const languages = Array.from(new Set(channels.map(ch => ch.language).filter(lang => !!lang))).sort();
  const countries = Array.from(new Set(channels.map(ch => ch.country).filter(country => !!country))).sort();

  const handleChannelClick = (channel: Channel) => {
    router.push(`/live-tv/${channel.nanoid}`);
  };

  if (loading) {
    return (
      <div className="live-tv">
        <div className="container">
          <div className="loading">Loading channels...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="live-tv">
      <div className="container">
        <header className="hero">
          <h1>Live TV Channels</h1>
          <p>Watch live television channels from around the world</p>
        </header>

        <div className="filters">
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="filter-select"
          >
            <option value="">All Languages</option>
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang.toUpperCase()}</option>
            ))}
          </select>

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="filter-select"
          >
            <option value="">All Countries</option>
            {countries.map(country => (
              <option key={country} value={country}>{country.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="channels-grid">
          {filteredChannels.map((channel) => (
            <div
              key={channel.nanoid}
              className="channel-card"
              onClick={() => handleChannelClick(channel)}
            >
              <div className="channel-info">
                <h3>{channel.name}</h3>
                <div className="channel-meta">
                  {channel.language && (
                    <span className="language">{channel.language.toUpperCase()}</span>
                  )}
                  {channel.country && (
                    <span className="country">{channel.country.toUpperCase()}</span>
                  )}
                </div>
                <div className="channel-sources">
                  {channel.iptv_urls.length > 0 && (
                    <span className="source iptv">
                      <FaGlobe /> IPTV
                    </span>
                  )}
                  {channel.youtube_urls.length > 0 && (
                    <span className="source youtube">
                      <FaYoutube /> YouTube
                    </span>
                  )}
                </div>
              </div>
              <div className="watch-button">
                <FaPlay />
                <span>Watch Now</span>
              </div>
            </div>
          ))}
        </div>

        {filteredChannels.length === 0 && (
          <div className="no-results">
            <p>No channels found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
