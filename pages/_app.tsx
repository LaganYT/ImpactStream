import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { TitleModalProvider } from "../components/TitleModal";

const WATCH_ROUTES = ["/movie/[id]", "/tv/[id]", "/anime/[id]"];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const isWatchRoute = WATCH_ROUTES.includes(router.pathname);

  const onSearch = () => {
    // Implement search logic or leave it as a placeholder
    console.log("Search triggered with query:", query);
  };

  useEffect(() => {
    document.body.classList.add("dark");
  }, []);

  return (
    <TitleModalProvider>
      <Navbar query={query} setQuery={setQuery} onSearch={onSearch} />
      <div className="app-content">
        <Component {...pageProps} />
      </div>
      {!isWatchRoute ? <Footer /> : null}
    </TitleModalProvider>
  );
}
