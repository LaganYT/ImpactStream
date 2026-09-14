import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "node:stream";

const VIDFAST_ORIGIN = "https://vidfast.vc";
const MEDIA_PROXY_PATH = "/api/vidfast-media-proxy";
const ALLOWED_MEDIA_HOST_SUFFIXES = [".peakstorm.top"];

function isAllowedMediaHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return ALLOWED_MEDIA_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix.slice(1) || normalized.endsWith(suffix)
  );
}

function getProxyUrl(url: string) {
  return `${MEDIA_PROXY_PATH}?url=${encodeURIComponent(url)}`;
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function rewritePlaylist(playlist: string, baseUrl: string) {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${getProxyUrl(resolveUrl(uri, baseUrl))}"`;
        });
      }

      return getProxyUrl(resolveUrl(trimmed, baseUrl));
    })
    .join("\n");
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!rawUrl) return res.status(400).json({ message: "Missing media URL" });

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ message: "Invalid media URL" });
  }

  if (targetUrl.protocol !== "https:" || !isAllowedMediaHost(targetUrl.hostname)) {
    return res.status(400).json({ message: "Unsupported media host" });
  }

  const headers = new Headers({
    Referer: `${VIDFAST_ORIGIN}/`,
    Origin: VIDFAST_ORIGIN,
    "User-Agent":
      (typeof req.headers["user-agent"] === "string" && req.headers["user-agent"]) ||
      "Mozilla/5.0 (compatible; ImpactStream/1.0)",
  });

  const range = req.headers.range;
  if (typeof range === "string") headers.set("Range", range);
  const accept = req.headers.accept;
  if (typeof accept === "string") headers.set("Accept", accept);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      redirect: "follow",
    });

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const isPlaylist =
      contentType.includes("mpegurl") || targetUrl.pathname.toLowerCase().endsWith(".m3u8");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", isPlaylist ? "no-store" : "public, max-age=30");

    for (const name of ["accept-ranges", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    if (isPlaylist) {
      const playlist = await upstream.text();
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.status(upstream.status).send(rewritePlaylist(playlist, targetUrl.toString()));
    }

    res.setHeader("Content-Type", contentType);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    if (req.method === "HEAD" || !upstream.body) {
      return res.status(upstream.status).end();
    }

    res.status(upstream.status);
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (error) {
    console.error("Vidfast media proxy request failed:", error);
    return res.status(502).json({ message: "Vidfast media proxy request failed" });
  }
}
