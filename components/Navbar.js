import React from "react";

export default function Navbar({ query, setQuery, onSearch }) {
  return (
    <nav className="navbar">
      <h1 className="logo">ImpactStream</h1>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search movies, shows, or anime..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSearch(); }}
        />
        <button onClick={onSearch}>Search</button>
      </div>
    </nav>
  );
}
