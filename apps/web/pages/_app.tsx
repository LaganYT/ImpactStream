import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useState } from "react";
import "../styles/globals.css";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { TitleModalProvider } from "../components/TitleModal";

const WATCH_ROUTES = ["/movie/[id]", "/tv/[id]", "/anime/[id]"];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const isWatchRoute = WATCH_ROUTES.includes(router.pathname);

  return (
    <TitleModalProvider>
      <Navbar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <div className="app-content">
        <Component {...pageProps} />
      </div>
      {!isWatchRoute ? <Footer /> : null}
    </TitleModalProvider>
  );
}
