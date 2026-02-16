import React from "react";
import { FaGithub, FaHeart } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <div className="footer-section">
            <h3>About</h3>
            <ul>
              <li><a href="https://github.com/LaganYT/ImpactStream" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
              <li><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Features</h3>
            <ul>
              <li>Multiple Streaming APIs</li>
              <li>Live TV Channels</li>
              <li>Search Movies & TV Shows</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} ImpactStream. Powered by TMDB and multiple streaming APIs.</p>
          <p style={{ marginTop: '0.5rem' }}>Made with <FaHeart style={{ color: '#e50914', display: 'inline' }} /> for streaming enthusiasts</p>
        </div>
      </div>
    </footer>
  );
}
