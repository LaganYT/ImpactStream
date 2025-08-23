import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { FaPlay, FaGlobe, FaYoutube, FaSearch, FaFilter, FaTv, FaGlobeAmericas, FaLanguage, FaChevronLeft, FaChevronRight } from "react-icons/fa";

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
  const [showFilters, setShowFilters] = useState(false);
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
    const matchesLanguage = !selectedLanguage || channel.language === selectedLanguage;
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

  const languages = Array.from(new Set(channels.map(ch => ch.language).filter(lang => !!lang))).sort();
  const countries = Array.from(new Set(channels.map(ch => ch.country).filter(country => !!country))).sort();

  const handleChannelClick = (channel: Channel) => {
    router.push(`/live-tv/${channel.nanoid}`);
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.youtube_urls.length > 0 && channel.iptv_urls.length > 0) {
      return <FaTv className="channel-icon" />;
    } else if (channel.youtube_urls.length > 0) {
      return <FaYoutube className="channel-icon youtube" />;
    } else {
      return <FaGlobe className="channel-icon iptv" />;
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of channels grid
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate pagination range with ellipsis
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

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
      <div className="live-tv">
        <div className="container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h2>Loading Live TV Channels</h2>
            <p>Discovering channels from around the world...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="live-tv">
      <div className="container">
        {/* Hero Section */}
        <header className="hero-section">
          <div className="hero-content">
            <div className="hero-icon">
              <FaTv />
            </div>
            <h1>Live TV Channels</h1>
            <p>Stream live television channels from around the world in high quality</p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">{channels.length}</span>
                <span className="stat-label">Channels</span>
              </div>
              <div className="stat">
                <span className="stat-number">{languages.length}</span>
                <span className="stat-label">Languages</span>
              </div>
              <div className="stat">
                <span className="stat-number">{countries.length}</span>
                <span className="stat-label">Countries</span>
              </div>
            </div>
          </div>
          <div className="hero-background">
            <div className="floating-icon icon-1">📺</div>
            <div className="floating-icon icon-2">🌍</div>
            <div className="floating-icon icon-3">📡</div>
            <div className="floating-icon icon-4">🎬</div>
          </div>
        </header>

        {/* Search and Filters */}
        <div className="search-section">
          <div className="search-container">
            <div className="search-input-wrapper">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search for channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <button 
              className="filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FaFilter />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <div className="filter-group">
                <label className="filter-label">
                  <FaLanguage />
                  Language
                </label>
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
              </div>

              <div className="filter-group">
                <label className="filter-label">
                  <FaGlobeAmericas />
                  Country
                </label>
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

              <button 
                className="clear-filters"
                onClick={() => {
                  setSelectedLanguage("");
                  setSelectedCountry("");
                  setSearchQuery("");
                }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="results-summary">
          <h3>
            {filteredChannels.length === channels.length 
              ? `All ${channels.length} channels available`
              : `${filteredChannels.length} of ${channels.length} channels`
            }
            {totalPages > 1 && (
              <span className="page-info">
                {" "}(Page {currentPage} of {totalPages})
              </span>
            )}
          </h3>
          {(selectedLanguage || selectedCountry || searchQuery) && (
            <div className="active-filters">
              {searchQuery && <span className="filter-tag">Search: "{searchQuery}"</span>}
              {selectedLanguage && <span className="filter-tag">Language: {selectedLanguage}</span>}
              {selectedCountry && <span className="filter-tag">Country: {selectedCountry}</span>}
            </div>
          )}
        </div>

        {/* Channels Grid */}
        <div className="channels-grid">
          {currentChannels.map((channel, index) => (
            <div
              key={channel.nanoid}
              className="channel-card"
              onClick={() => handleChannelClick(channel)}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="channel-header">
                <div className="channel-icon-wrapper">
                  {getChannelIcon(channel)}
                </div>
                <div className="channel-badge">
                  <FaPlay />
                </div>
              </div>
              
              <div className="channel-content">
                <h3 className="channel-name">{channel.name}</h3>
                
                <div className="channel-meta">
                  {channel.language && (
                    <span className="meta-tag language">
                      <FaLanguage />
                      {channel.language.toUpperCase()}
                    </span>
                  )}
                  {channel.country && (
                    <span className="meta-tag country">
                      <FaGlobeAmericas />
                      {channel.country.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="channel-sources">
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
              </div>

              <div className="channel-footer">
                <div className="watch-now">
                  <FaPlay />
                  <span>Watch Now</span>
                </div>
              </div>
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
            <button 
              className="clear-filters-btn"
              onClick={() => {
                setSelectedLanguage("");
                setSelectedCountry("");
                setSearchQuery("");
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
