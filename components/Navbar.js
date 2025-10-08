import React from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FaGithub, FaTv, FaHome, FaSearch } from "react-icons/fa";

export default function Navbar({ query, setQuery, onSearch }) {
  const router = useRouter();

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/?query=${encodeURIComponent(query)}`);
      onSearch();
    }
  };

  return (
    <nav className="navbar">
      <Link href="/"><h1 className="logo">ImpactStream</h1></Link>
      <div className="nav-links">
        <Link href="/" className="nav-link">
          <FaHome /> Home
        </Link>
        <Link href="/live-tv" className="nav-link">
          <FaTv /> Live TV
        </Link>
      </div>
      <div className="search-bar">
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
      <a
        href="https://github.com/LaganYT/ImpactStream"
        target="_blank"
        rel="noopener noreferrer"
        className="github-icon"
        aria-label="View on GitHub"
      >
        <FaGithub size={24} />
      </a>
    </nav>
  );
}
