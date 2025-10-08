import React from "react";

export default function Footer() {
  return (
    <footer className="footer">
      <div>
        <span>
          &copy; {new Date().getFullYear()} ImpactStream &mdash; Powered by TMDB and multiple streaming APIs.
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
        <span>Made with ❤️ for streaming enthusiasts</span>
      </div>
    </footer>
  );
}
