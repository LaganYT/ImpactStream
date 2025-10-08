import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FaGithub, FaTv, FaHome, FaSearch, FaBars, FaTimes } from "react-icons/fa";

export default function Navbar({ query, setQuery, onSearch }) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/?query=${encodeURIComponent(query)}`);
      onSearch();
    }
  };

  const toggleMobileMenu = () => {
    console.log('Mobile menu button clicked, current state:', isMobileMenuOpen);
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="navbar">
      <Link href="/"><h1 className="logo">ImpactStream</h1></Link>
      
      {/* Desktop Navigation */}
      <div className="nav-links desktop-nav">
        <Link href="/" className="nav-link">
          <FaHome /> Home
        </Link>
        <Link href="/live-tv" className="nav-link">
          <FaTv /> Live TV
        </Link>
      </div>
      
      {/* Desktop Search */}
      <div className="search-bar desktop-search">
        <input
          type="text"
          placeholder="Search movies, shows, or anime..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
        <button onClick={handleSearch}>
          <FaSearch style={{ marginRight: '0.3rem' }} /> Search
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
        <FaGithub size={24} />
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

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
        <div className="mobile-nav-links">
          <Link href="/" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>
            <FaHome /> Home
          </Link>
          <Link href="/live-tv" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>
            <FaTv /> Live TV
          </Link>
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