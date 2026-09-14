import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-brand">ImpactStream</span>
        <div className="footer-links">
          <Link href="/">Home</Link>
          <Link href="/live-tv">Live TV</Link>
          <a
            href="https://github.com/LaganYT/ImpactStream"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
        <span>
          &copy;{new Date().getFullYear()} ImpactStream. Made with ❤️ for streaming
          enthusiasts.
        </span>
      </div>
    </footer>
  );
}
