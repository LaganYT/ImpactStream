import Link from "next/link";
import { FaGithub } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <Link href="/" className="logo">
            Impact<span>Stream</span>
          </Link>
          <nav className="footer-links" aria-label="Footer">
            <Link href="/browse/movie">Movies</Link>
            <Link href="/browse/tv">Shows</Link>
            <Link href="/browse/anime">Anime</Link>
            <Link href="/live-tv">Live TV</Link>
            <Link href="/my-list">My List</Link>
            <a
              href="https://github.com/LaganYT/ImpactStream"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGithub aria-hidden /> GitHub
            </a>
          </nav>
        </div>
        <p className="footer-note">
          ImpactStream doesn&apos;t host any files. Playback and downloads come from third-party
          providers. Titles, artwork, and ratings come from{" "}
          <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
            TMDB
          </a>
          ; this product uses the TMDB API but isn&apos;t endorsed or certified by TMDB.
        </p>
        <p className="footer-note">&copy; {new Date().getFullYear()} ImpactStream</p>
      </div>
    </footer>
  );
}
