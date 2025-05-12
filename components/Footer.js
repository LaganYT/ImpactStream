import React from "react";

export default function Footer() {
  return (
    <footer className="bg-navbar dark:bg-darkNavbar text-textSecondary dark:text-darkTextSecondary text-center py-4 mt-12">
      <span>
        &copy; {new Date().getFullYear()} ImpactStream &mdash; Powered by TMDB and multiple streaming APIs. Navbar, not header.
      </span>
    </footer>
  );
}
