import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import {
  FaChevronLeft,
  FaChevronRight,
  FaGlobe,
  FaPlay,
  FaSearch,
  FaTv,
  FaYoutube,
} from "react-icons/fa";

interface Channel {
  nanoid: string;
  name: string;
  iptv_urls: string[];
  youtube_urls: string[];
  language: string;
  languages?: string[];
  country: string;
  category?: string;
  isGeoBlocked: boolean;
  hasGuide?: boolean;
  guideCount?: number;
}

const DEFAULT_LANGUAGE = "eng";
const DEFAULT_COUNTRY = "US";
const CHANNELS_PER_PAGE = 50;
const PAGE_WINDOW = 2;

export default function LiveTvPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await axios.get<Channel[]>("/api/live-tv");
        setChannels(response.data);
      } catch (error) {
        console.error("Error fetching channels:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLanguage, selectedCountry, selectedCategory]);

  const filteredChannels = channels.filter((channel) => {
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase());
    const channelLanguages = channel.languages?.length ? channel.languages : [channel.language];
    const matchesLanguage = !selectedLanguage || channelLanguages.includes(selectedLanguage);
    const matchesCountry = !selectedCountry || channel.country === selectedCountry;
    const matchesCategory = !selectedCategory || channel.category === selectedCategory;
    return matchesSearch && matchesLanguage && matchesCountry && matchesCategory;
  });

  const totalPages = Math.ceil(filteredChannels.length / CHANNELS_PER_PAGE);
  const pageStart = (currentPage - 1) * CHANNELS_PER_PAGE;
  const visibleChannels = filteredChannels.slice(pageStart, pageStart + CHANNELS_PER_PAGE);

  const languages = Array.from(
    new Set(
      channels
        .flatMap((channel) =>
          channel.languages?.length ? channel.languages : [channel.language]
        )
        .filter(Boolean)
    )
  ).sort();
  const countries = Array.from(
    new Set(channels.map((channel) => channel.country).filter(Boolean))
  ).sort();
  const categories = Array.from(
    new Set(channels.map((channel) => channel.category).filter(Boolean))
  ).sort();
  const hasActiveFilters = Boolean(
    searchTerm || selectedLanguage || selectedCountry || selectedCategory
  );

  const openChannel = (channel: Channel) => {
    router.push(`/live-tv/${channel.nanoid}`);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedLanguage("");
    setSelectedCountry("");
    setSelectedCategory("");
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.youtube_urls.length > 0 && channel.iptv_urls.length === 0) return <FaYoutube />;
    if (channel.iptv_urls.length > 0 && channel.youtube_urls.length === 0) return <FaGlobe />;
    return <FaTv />;
  };

  const changePage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPaginationItems = (): Array<number | "..."> => {
    const middlePages: number[] = [];
    const items: Array<number | "..."> = [];

    for (
      let page = Math.max(2, currentPage - PAGE_WINDOW);
      page <= Math.min(totalPages - 1, currentPage + PAGE_WINDOW);
      page += 1
    ) {
      middlePages.push(page);
    }

    if (currentPage - PAGE_WINDOW > 2) items.push(1, "...");
    else items.push(1);

    items.push(...middlePages);

    if (currentPage + PAGE_WINDOW < totalPages - 1) items.push("...", totalPages);
    else if (totalPages > 1) items.push(totalPages);

    return items;
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-container">
          <div className="loading-spinner" />
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
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search channels"
          />
        </div>

        <select
          className="toolbar-select"
          value={selectedLanguage}
          onChange={(event) => setSelectedLanguage(event.target.value)}
          aria-label="Filter by language"
        >
          <option value="">All Languages</option>
          {languages.map((language) => (
            <option key={language} value={language}>
              {language.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          className="toolbar-select"
          value={selectedCountry}
          onChange={(event) => setSelectedCountry(event.target.value)}
          aria-label="Filter by country"
        >
          <option value="">All Countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          className="toolbar-select"
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
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

      <div className="channels-grid">
        {visibleChannels.map((channel) => (
          <div
            key={channel.nanoid}
            className="channel-card"
            onClick={() => openChannel(channel)}
          >
            <div className="channel-card-top">
              <div className="channel-logo">{getChannelIcon(channel)}</div>
              <div className="channel-card-titles">
                <h3>{channel.name}</h3>
                <p>
                  {[channel.language, channel.country]
                    .concat(channel.category ? [channel.category] : [])
                    .filter(Boolean)
                    .map((value) => value.toUpperCase())
                    .join(" • ") || "Live channel"}
                </p>
              </div>
            </div>

            <div className="channel-card-badges">
              {channel.iptv_urls.length > 0 ? (
                <span className="source-badge iptv">
                  <FaGlobe />
                  IPTV ({channel.iptv_urls.length})
                </span>
              ) : null}
              {channel.youtube_urls.length > 0 ? (
                <span className="source-badge youtube">
                  <FaYoutube />
                  YouTube ({channel.youtube_urls.length})
                </span>
              ) : null}
              {channel.hasGuide ? (
                <span className="source-badge">Guide ({channel.guideCount || 1})</span>
              ) : null}
            </div>

            <span className="channel-watch">
              <FaPlay size={11} /> Watch now
            </span>
          </div>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <FaChevronLeft />
            Previous
          </button>

          <div className="page-numbers">
            {getPaginationItems().map((item, index) => (
              <button
                key={`${item}-${index}`}
                className={`page-number ${item === currentPage ? "active" : ""} ${item === "..." ? "ellipsis" : ""}`}
                onClick={() => {
                  if (typeof item === "number") changePage(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            className="pagination-btn"
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
            <FaChevronRight />
          </button>
        </div>
      ) : null}

      {filteredChannels.length === 0 ? (
        <div className="no-results">
          <div className="no-results-icon">
            <FaTv />
          </div>
          <h3>No channels found</h3>
          <p>Try adjusting your search criteria or filters</p>
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear All Filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
