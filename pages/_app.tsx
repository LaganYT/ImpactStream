import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { TitleModalProvider } from "../components/TitleModal";

const WATCH_ROUTES = ["/movie/[id]", "/tv/[id]", "/anime/[id]"];
const DOWNLOAD_LOG_PREFIX = "[ImpactStream Download]";
const HLS_PROXY_HOST = "vidsrc-scraper-serverless.vercel.app";
const HLS_PROXY_PATH = "/hls-proxy";
const HLS_FETCH_RETRY_DELAYS = [750, 1500, 3000, 6000, 10000];

function sleep(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function installDownloadFetchRetries() {
  const marker = "__impactStreamDownloadFetchRetryInstalled";
  const markedWindow = window as typeof window & Record<string, unknown>;
  if (markedWindow[marker]) return () => {};
  markedWindow[marker] = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    let url: URL | null = null;
    try {
      const value = input instanceof Request ? input.url : input.toString();
      url = new URL(value, window.location.href);
    } catch {
      return nativeFetch(input, init);
    }

    const shouldRetry =
      method === "GET" &&
      url.hostname === HLS_PROXY_HOST &&
      url.pathname === HLS_PROXY_PATH;

    if (!shouldRetry) return nativeFetch(input, init);

    const signal = init?.signal || (input instanceof Request ? input.signal : undefined);
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= HLS_FETCH_RETRY_DELAYS.length; attempt += 1) {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");

      try {
        const response = await nativeFetch(input, init);
        // Retry temporary upstream/server failures as well as browser-level network errors.
        if (response.ok || ![408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
          if (attempt > 0) {
            console.log(DOWNLOAD_LOG_PREFIX, {
              event: "segment-fetch-recovered",
              attempt: attempt + 1,
              status: response.status,
              path: url.pathname,
            });
          }
          return response;
        }
        lastError = new Error(`Temporary HLS proxy response (${response.status}).`);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        lastError = error;
      }

      if (attempt >= HLS_FETCH_RETRY_DELAYS.length) break;
      const delay = HLS_FETCH_RETRY_DELAYS[attempt];
      console.warn(DOWNLOAD_LOG_PREFIX, {
        event: "segment-fetch-retry",
        attempt: attempt + 1,
        nextAttempt: attempt + 2,
        delayMs: delay,
        online: navigator.onLine,
        error: lastError instanceof Error ? lastError.message : String(lastError),
        path: url.pathname,
      });
      await sleep(delay, signal);
    }

    console.error(DOWNLOAD_LOG_PREFIX, {
      event: "segment-fetch-exhausted",
      attempts: HLS_FETCH_RETRY_DELAYS.length + 1,
      online: navigator.onLine,
      error: lastError instanceof Error ? lastError.message : String(lastError),
      path: url.pathname,
    });
    throw lastError instanceof Error ? lastError : new Error("HLS segment request failed after retries.");
  };

  return () => {
    window.fetch = nativeFetch;
    delete markedWindow[marker];
  };
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const isWatchRoute = WATCH_ROUTES.includes(router.pathname);

  const onSearch = () => {
    console.log("Search triggered with query:", query);
  };

  useEffect(() => {
    document.body.classList.add("dark");
    return installDownloadFetchRetries();
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
