import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { FaArrowUp } from "react-icons/fa";
import "../styles/globals.css";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { TitleModalProvider } from "../components/TitleModal";

const WATCH_ROUTES = ["/movie/[id]", "/tv/[id]", "/anime/[id]"];

// Appears once you've scrolled more than a screen down a long page.
function ScrollTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const update = () => setIsVisible(window.scrollY > window.innerHeight * 1.2);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <button
      className={isVisible ? "icon-button scroll-top visible" : "icon-button scroll-top"}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      tabIndex={isVisible ? 0 : -1}
    >
      <FaArrowUp />
    </button>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isWatchRoute = WATCH_ROUTES.includes(router.pathname);

  return (
    <TitleModalProvider>
      <Navbar />
      <div className="app-content">
        <Component {...pageProps} />
      </div>
      {!isWatchRoute ? (
        <>
          <Footer />
          <ScrollTopButton />
        </>
      ) : null}
    </TitleModalProvider>
  );
}
