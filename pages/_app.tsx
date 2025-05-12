import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function App({ Component, pageProps }: AppProps) {
  const [query, setQuery] = useState("");

  const onSearch = () => {
    // Implement search logic or leave it as a placeholder
    console.log("Search triggered with query:", query);
  };

  useEffect(() => {
    document.body.classList.add("dark");
  }, []);

  return (
    <>
      <Navbar query={query} setQuery={setQuery} onSearch={onSearch} />
      <Component {...pageProps} />
      <Footer />
    </>
  );
}
