import React from "react";

export default function Footer() {
  return (
    <footer className="footer">
      <span>
        &copy; {new Date().getFullYear()} ImpactStream &mdash; Powered by TMDB and multiple streaming APIs.
      </span>
    </footer>
  );
}
