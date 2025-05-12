import "../styles/globals.css";
import "../styles/animations.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.body.classList.add('dark');
  }, []);
  return (
    <Component {...pageProps} />
  );
}
