import type { AppProps } from "next/app";
import { useEffect } from "react";
import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.body.classList.add('dark');
  }, []);
  return (
    <Component {...pageProps} />
  );
}
