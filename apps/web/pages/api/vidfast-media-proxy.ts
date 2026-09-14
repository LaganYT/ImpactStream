import type { NextApiRequest, NextApiResponse } from "next";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readable } from "node:stream";

const VIDFAST_ORIGIN = "https://vidfast.vc";
const MEDIA_PROXY_PATH = "/api/vidfast-media-proxy";

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) return false;

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function isPrivateIp(address: string) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return false;
}

async function isPublicHttpsTarget(url: URL) {
  if (url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  if (isPrivateIp(hostname)) return false;

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateIp(address));
  } catch {
    return false;
  }
}

function getRequestOrigin(req: NextApiRequest) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const protocol =
    (typeof forwardedProto === "string" && forwardedProto.split(",")[0]?.trim()) ||
    (req.headers.host?.startsWith("localhost") ? "http" : "https");
  const host =
    (typeof forwardedHost === "string" && forwardedHost.split(",")[0]?.trim()) ||
    req.headers.host;

  return host ? `${protocol}://${host}` : "";
}

function getProxyUrl(url: string, requestOrigin: string) {
  return `${requestOrigin}${MEDIA_PROXY_PATH}?url=${encodeURIComponent(url)}`;
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function rewritePlaylist(playlist: string, baseUrl: string, requestOrigin: string) {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${getProxyUrl(resolveUrl(uri, baseUrl), requestOrigin)}"`;
        });
      }

      return getProxyUrl(resolveUrl(trimmed, baseUrl), requestOrigin);
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

  if (!(await isPublicHttpsTarget(targetUrl))) {
    return res.status(400).json({ message: "Unsupported media target" });
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
      const requestOrigin = getRequestOrigin(req);
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res
        .status(upstream.status)
        .send(rewritePlaylist(playlist, targetUrl.toString(), requestOrigin));
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
