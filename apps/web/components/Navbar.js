import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FaBars, FaGithub, FaHome, FaSearch, FaTimes, FaTv } from "react-icons/fa";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: FaHome },
  { href: "/live-tv", label: "Live TV", icon: FaTv },
];

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

  const submitSearch = () => {
    const normalizedSearchTerm = searchTerm.trim();
    if (!normalizedSearchTerm) return;

    router.push(`/?query=${encodeURIComponent(normalizedSearchTerm)}`);
  };

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
