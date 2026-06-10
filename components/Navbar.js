import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FaGithub, FaTv, FaHome, FaSearch, FaBars, FaTimes, FaDragon, FaHistory } from "react-icons/fa";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: FaHome },
  { href: "/anime", label: "Anime", icon: FaDragon },
  { href: "/live-tv", label: "Live TV", icon: FaTv },
  { href: "/continue-watching", label: "Continue Watching", icon: FaHistory },
];

export default function Navbar({ query, setQuery, onSearch }) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/?query=${encodeURIComponent(query)}`);
      onSearch();
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isActive = (href) =>
    href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);

  return (
    <nav className={`navbar ${isScrolled || isMobileMenuOpen ? "navbar-solid" : ""}`}>
      <div className="navbar-left">
        <Link href="/"><h1 className="logo">ImpactStream</h1></Link>

        {/* Desktop Navigation */}
        <div className="nav-links desktop-nav">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
            >
              <Icon /> {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="navbar-right">
        {/* Desktop Search */}
        <div className="search-bar desktop-search">
          <input
            type="text"
            placeholder="Titles, people, genres..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            aria-label="Search movies, shows, or anime"
          />
          <button onClick={handleSearch} aria-label="Search">
            <FaSearch />
          </button>
        </div>

        {/* GitHub Link */}
        <a
          href="https://github.com/LaganYT/ImpactStream"
          target="_blank"
          rel="noopener noreferrer"
          className="github-icon desktop-github"
          aria-label="View on GitHub"
        >
          <FaGithub size={20} />
        </a>

        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-button"
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
          style={{
            display: 'none', // Will be overridden by CSS media queries
            minWidth: '44px',
            minHeight: '44px'
          }}
        >
          {isMobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
                setIsMobileMenuOpen(false);
              }
            }}
          />
          <button onClick={() => {
            handleSearch();
            setIsMobileMenuOpen(false);
          }}>
            <FaSearch /> Search
          </button>
        </div>
      </div>
    </nav>
  );
}
