import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  FaArrowRight,
  FaBars,
  FaBookmark,
  FaDragon,
  FaFilm,
  FaHome,
  FaSearch,
  FaStar,
  FaTimes,
  FaTv,
  FaVideo,
} from "react-icons/fa";
import { useTitleModal } from "./TitleModal";
import {
  flattenSearchResults,
  getYear,
  matchesType,
  mediaItemKey,
  toTitleRef,
  TYPE_FILTERS,
  typeLabel,
} from "../utils/mediaItems";
import { posterUrl } from "../utils/posters";
import { tmdbFetch } from "../utils/tmdbClient";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: FaHome },
  { href: "/browse/movie", label: "Movies", icon: FaFilm },
  { href: "/browse/tv", label: "Shows", icon: FaVideo },
  { href: "/browse/anime", label: "Anime", icon: FaDragon },
  { href: "/live-tv", label: "Live TV", icon: FaTv },
  { href: "/my-list", label: "My List", icon: FaBookmark },
];

const SEARCH_DEBOUNCE_MS = 250;
const QUICK_RESULT_COUNT = 6;

const searchUrl = (term, filter) =>
  `/search?q=${encodeURIComponent(term.trim())}${filter === "all" ? "" : `&type=${filter}`}`;

// Search that opens inside the nav pill and shows quick results as you type.
function NavSearch({ onClose }) {
  const router = useRouter();
  const { openTitle } = useTitleModal();
  const panelRef = useRef(null);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState(null);

  useEffect(() => {
    const query = term.trim();
    if (!query) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      tmdbFetch("search/multi", { query })
        .then((data) => {
          if (!cancelled) setResults(flattenSearchResults(data.results || []));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [term]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const goToResults = () => {
    if (!term.trim()) return;
    router.push(searchUrl(term, filter));
    onClose();
  };

  const visible = (results || []).filter((item) => matchesType(item, filter)).slice(0, QUICK_RESULT_COUNT);

  return (
    <div className="nav-search" ref={panelRef}>
      <div className="nav-search-field">
        <FaSearch aria-hidden />
        <input
          autoFocus
          type="search"
          placeholder="Search movies, shows, and anime"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") goToResults();
          }}
          aria-label="Search movies, shows, and anime"
        />
        <button className="icon-button" onClick={onClose} aria-label="Close search">
          <FaTimes />
        </button>
      </div>

      {term.trim() ? (
        <div className="nav-search-panel">
          <div className="nav-search-tabs" role="tablist" aria-label="Result type">
            {TYPE_FILTERS.map((option) => (
              <button
                key={option.id}
                role="tab"
                aria-selected={filter === option.id}
                className={filter === option.id ? "active" : undefined}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {results === null ? (
            <p className="nav-search-status">Searching…</p>
          ) : visible.length === 0 ? (
            <p className="nav-search-status">No matches yet. Try another word.</p>
          ) : (
            <ul className="nav-search-results">
              {visible.map((item) => (
                <li key={mediaItemKey(item)}>
                  <button
                    onClick={() => {
                      openTitle(toTitleRef(item));
                      onClose();
                    }}
                  >
                    <img src={posterUrl(item.poster_path, "w92")} alt="" />
                    <span className="nav-result-text">
                      <strong>{item.title || item.name}</strong>
                      <span className="card-meta">
                        {item.vote_average ? (
                          <span className="card-rating">
                            <FaStar aria-hidden /> {item.vote_average.toFixed(1)}
                          </span>
                        ) : null}
                        {getYear(item) ? <span>{getYear(item)}</span> : null}
                        <span>{typeLabel(item)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="nav-search-all" onClick={goToResults}>
            See all results for “{term.trim()}” <FaArrowRight aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileTerm, setMobileTerm] = useState("");

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  // "/" opens search from anywhere, unless you're already typing somewhere.
  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setIsSearchOpen(false);
    setIsMobileMenuOpen(false);
  }, [router.asPath]);

  const closeSearch = useRef(() => setIsSearchOpen(false)).current;

  const submitMobileSearch = () => {
    if (!mobileTerm.trim()) return;
    router.push(searchUrl(mobileTerm, "all"));
    setIsMobileMenuOpen(false);
  };

  const isActiveRoute = (href) =>
    href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);

  return (
    <nav className={`navbar ${isScrolled || isMobileMenuOpen ? "navbar-scrolled" : ""}`}>
      <Link href="/" className="logo" aria-label="ImpactStream home">
        Impact<span>Stream</span>
      </Link>

      <div className={`nav-pill desktop-nav ${isSearchOpen ? "searching" : ""}`}>
        {isSearchOpen ? (
          <NavSearch onClose={closeSearch} />
        ) : (
          <>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${isActiveRoute(href) ? "active" : ""}`}
                aria-current={isActiveRoute(href) ? "page" : undefined}
              >
                <Icon aria-hidden /> {label}
              </Link>
            ))}
            <span className="nav-divider" aria-hidden />
            <button
              className="icon-button nav-search-toggle"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search (press /)"
              title="Search (press /)"
            >
              <FaSearch />
            </button>
          </>
        )}
      </div>

      <button
        className="icon-button mobile-menu-button"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        aria-label="Toggle menu"
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
      </button>

      <div className={`mobile-menu ${isMobileMenuOpen ? "mobile-menu-open" : ""}`}>
        <div className="mobile-search">
          <FaSearch aria-hidden />
          <input
            type="search"
            placeholder="Search movies, shows, and anime"
            value={mobileTerm}
            onChange={(event) => setMobileTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitMobileSearch();
            }}
            aria-label="Search movies, shows, and anime"
          />
        </div>
        <div className="mobile-nav-links">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`mobile-nav-link ${isActiveRoute(href) ? "active" : ""}`}
            >
              <Icon aria-hidden /> {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
