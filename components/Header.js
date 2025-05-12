import React from "react";

export default function Navbar({ query, setQuery, onSearch }) {
  return (
    <nav className="bg-navbar dark:bg-darkNavbar text-white px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between shadow-lg">
      <h1 className="text-3xl font-bold text-accent mb-2 md:mb-0 cursor-pointer select-none">
        ImpactStream
      </h1>
      <div className="flex items-center space-x-2 w-full md:w-auto">
        <input
          type="text"
          placeholder="Search movies, shows, or anime..."
          className="p-2 rounded bg-input text-white dark:bg-darkInput dark:text-darkTextPrimary w-full md:w-64"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSearch(); }}
        />
        <button
          onClick={onSearch}
          className="bg-accent text-white px-4 py-2 rounded hover:bg-accentHover transition"
        >
          Search
        </button>
      </div>
    </nav>
  );
}
