import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  FaBars,
  FaBookmark,
  FaDragon,
  FaFilm,
  FaGithub,
  FaHome,
  FaSearch,
  FaTimes,
  FaTv,
  FaVideo,
} from "react-icons/fa";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: FaHome },
  { href: "/browse/movie", label: "Movies", icon: FaFilm },
  { href: "/browse/tv", label: "TV Shows", icon: FaVideo },
  { href: "/browse/anime", label: "Anime", icon: FaDragon },
  { href: "/live-tv", label: "Live TV", icon: FaTv },
  { href: "/my-list", label: "My List", icon: FaBookmark },
];

const SEARCH_DEBOUNCE_MS = 350;

export default function Navbar({ searchTerm, setSearchTerm }) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  const routeQuery = router.pathname === "/search" && typeof router.query.q === "string"
    ? router.query.q
    : "";
  const lastPushedQuery = useRef(routeQuery);

  // Keep the input in sync when the URL changes (back/forward, shared links).
  useEffect(() => {
    if (routeQuery !== lastPushedQuery.current) {
      lastPushedQuery.current = routeQuery;
      setSearchTerm(routeQuery);
    }
  }, [routeQuery, setSearchTerm]);

  const goToSearch = (term, { replace = false } = {}) => {
    const normalizedSearchTerm = term.trim();
    if (!normalizedSearchTerm || normalizedSearchTerm === lastPushedQuery.current) return;

    lastPushedQuery.current = normalizedSearchTerm;
    const url = `/search?q=${encodeURIComponent(normalizedSearchTerm)}`;
    if (replace) router.replace(url, undefined, { scroll: false });
    else router.push(url);
  };

  // Live search: results update as the viewer types. While already on the
  // search page, replace history entries instead of stacking one per keystroke.
  useEffect(() => {
    if (!searchTerm.trim()) return;

    const timeout = window.setTimeout(
      () => goToSearch(searchTerm, { replace: router.pathname === "/search" }),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const submitSearch = () => goToSearch(searchTerm);

  const isActiveRoute = (href) =>
    href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);

  return (
    <nav className={`navbar ${isScrolled || isMobileMenuOpen ? "navbar-solid" : ""}`}>
      <div className="navbar-left">
        <Link href="/">
          <h1 className="logo">ImpactStream</h1>
        </Link>

        <div className="nav-links desktop-nav">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${isActiveRoute(href) ? "nav-link-active" : ""}`}
            >
              <Icon /> {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="navbar-right">
        <div className="search-bar desktop-search">
          <input
            type="text"
            placeholder="Titles, people, genres..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            aria-label="Search movies, shows, or anime"
          />
          <button onClick={submitSearch} aria-label="Search">
            <FaSearch />
          </button>
        </div>

        <a
          href="https://github.com/LaganYT/ImpactStream"
          target="_blank"
          rel="noopener noreferrer"
          className="github-icon desktop-github"
          aria-label="View on GitHub"
        >
          <FaGithub size={20} />
        </a>

        <button
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-label="Toggle mobile menu"
          style={{ display: "none", minWidth: "44px", minHeight: "44px" }}
        >
          {isMobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
      </div>

      <div className={`mobile-menu ${isMobileMenuOpen ? "mobile-menu-open" : ""}`}>
        <div className="mobile-nav-links">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Icon /> {label}
            </Link>
          ))}
        </div>

        <div className="mobile-search">
          <input
            type="text"
            placeholder="Search movies, shows, or anime..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitSearch();
                setIsMobileMenuOpen(false);
              }
            }}
          />
          <button
            onClick={() => {
              submitSearch();
              setIsMobileMenuOpen(false);
            }}
          >
            <FaSearch /> Search
          </button>
        </div>
      </div>
    </nav>
  );
}
