import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { FaPlay, FaGlobe, FaYoutube, FaSearch, FaTv, FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface Channel {
  nanoid: string;
  name: string;
  iptv_urls: string[];
  youtube_urls: string[];
  language: string;
  languages?: string[];
  country: string;
  isGeoBlocked: boolean;
}

const DEFAULT_LANGUAGE = "eng";
const DEFAULT_COUNTRY = "US";

export default function LiveTV() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [currentPage, setCurrentPage] = useState(1);
  const channelsPerPage = 50;

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
    const channelLanguages = channel.languages?.length ? channel.languages : [channel.language];
    const matchesLanguage = !selectedLanguage || channelLanguages.includes(selectedLanguage);
    const matchesCountry = !selectedCountry || channel.country === selectedCountry;
    return matchesSearch && matchesLanguage && matchesCountry;
  });

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedLanguage, selectedCountry]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredChannels.length / channelsPerPage);
  const startIndex = (currentPage - 1) * channelsPerPage;
  const endIndex = startIndex + channelsPerPage;
  const currentChannels = filteredChannels.slice(startIndex, endIndex);

  const languages = Array.from(
    new Set(
      channels
        .flatMap(ch => ch.languages?.length ? ch.languages : [ch.language])
        .filter(lang => !!lang)
    )
  ).sort();
  const countries = Array.from(new Set(channels.map(ch => ch.country).filter(country => !!country))).sort();
  const hasActiveFilters = Boolean(searchQuery || selectedLanguage || selectedCountry);

  const handleChannelClick = (channel: Channel) => {
    router.push(`/live-tv/${channel.nanoid}`);
  };

  const clearFilters = () => {
    setSelectedLanguage("");
    setSelectedCountry("");
    setSearchQuery("");
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.youtube_urls.length > 0 && channel.iptv_urls.length === 0) {
      return <FaYoutube />;
    }
    if (channel.iptv_urls.length > 0 && channel.youtube_urls.length === 0) {
      return <FaGlobe />;
    }
    return <FaTv />;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of channels grid
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate pagination range with ellipsis
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>Loading Live TV</h2>
          <p>Discovering channels from around the world...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Live TV</h1>
          <p className="page-subtitle">
            {channels.length.toLocaleString()} channels • {languages.length} languages •{" "}
            {countries.length} countries
          </p>
        </div>
      </header>

      <div className="livetv-toolbar">
        <div className="toolbar-search">
          <FaSearch />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search channels"
          />
        </div>

        <select
          className="toolbar-select"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          aria-label="Filter by language"
        >
          <option value="">All Languages</option>
          {languages.map(lang => (
            <option key={lang} value={lang}>{lang.toUpperCase()}</option>
          ))}
        </select>

        <select
          className="toolbar-select"
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          aria-label="Filter by country"
        >
          <option value="">All Countries</option>
          {countries.map(country => (
            <option key={country} value={country}>{country.toUpperCase()}</option>
          ))}
        </select>

        {hasActiveFilters ? (
          <button className="toolbar-clear" onClick={clearFilters}>
            Clear
          </button>
        ) : null}
      </div>

      {hasActiveFilters ? (
        <p className="livetv-summary">
          {filteredChannels.length.toLocaleString()} of {channels.length.toLocaleString()} channels
          {totalPages > 1 ? ` — page ${currentPage} of ${totalPages}` : ""}
        </p>
      ) : null}

      {/* Channels Grid */}
      <div className="channels-grid">
        {currentChannels.map((channel) => (
          <div
            key={channel.nanoid}
            className="channel-card"
            onClick={() => handleChannelClick(channel)}
          >
            <div className="channel-card-top">
              <div className="channel-logo">{getChannelIcon(channel)}</div>
              <div className="channel-card-titles">
                <h3>{channel.name}</h3>
                <p>
                  {[channel.language, channel.country]
                    .filter(Boolean)
                    .map((value) => value.toUpperCase())
                    .join(" • ") || "Live channel"}
                </p>
              </div>
            </div>

            <div className="channel-card-badges">
              {channel.iptv_urls.length > 0 && (
                <span className="source-badge iptv">
                  <FaGlobe />
                  IPTV ({channel.iptv_urls.length})
                </span>
              )}
              {channel.youtube_urls.length > 0 && (
                <span className="source-badge youtube">
                  <FaYoutube />
                  YouTube ({channel.youtube_urls.length})
                </span>
              )}
            </div>

            <span className="channel-watch">
              <FaPlay size={11} /> Watch now
            </span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <FaChevronLeft />
            Previous
          </button>

          <div className="page-numbers">
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                className={`page-number ${page === currentPage ? 'active' : ''} ${page === '...' ? 'ellipsis' : ''}`}
                onClick={() => {
                  if (typeof page === 'number') {
                    handlePageChange(page);
                  }
                }}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <FaChevronRight />
          </button>
        </div>
      )}

      {/* No Results */}
      {filteredChannels.length === 0 && (
        <div className="no-results">
          <div className="no-results-icon">📺</div>
          <h3>No channels found</h3>
          <p>Try adjusting your search criteria or filters</p>
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
