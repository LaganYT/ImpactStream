import React from "react";
import { useRouter } from "next/router";

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
        <button onClick={handleSearch}>Search</button>
      </div>
    </nav>
  );
}
