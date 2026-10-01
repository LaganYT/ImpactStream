import type { NextApiRequest, NextApiResponse } from 'next';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Readable } from 'stream';

const PRIVATE_IPV4_RANGES = [
  /^0\./,
  /^10\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^(22[4-9]|2[3-5]\d)\./,
];
const PRIVATE_IPV6_RANGES = [/^::1?$/, /^f[cd]/, /^fe[89ab]/, /^ff/];
const MAX_REDIRECTS = 5;
const EXTERNAL_PROXY_HOSTS = new Set(['cors-proxy.cooks.fyi']);

const getProxyUrl = (url: string) => `/api/stream-proxy?url=${encodeURIComponent(url)}`;

const unwrapExternalProxyUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    const path = `${parsedUrl.pathname.slice(1)}${parsedUrl.search}`;

    if (EXTERNAL_PROXY_HOSTS.has(parsedUrl.hostname) && /^https?:\/\//i.test(path)) {
      return decodeURIComponent(path);
    }
  } catch {
    return url;
  }

  return url;
};

// Handles both `::ffff:127.0.0.1` and the hex form `::ffff:7f00:1` that URL parsing produces.
const getMappedIpv4 = (address: string) => {
  const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dotted) return dotted;

  const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return undefined;

  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
};

const isPrivateAddress = (address: string) => {
  const normalizedAddress = address.toLowerCase().replace(/^\[|\]$/g, '');
  const mappedIpv4 = getMappedIpv4(normalizedAddress);

  if (mappedIpv4 || isIP(normalizedAddress) === 4) {
    return PRIVATE_IPV4_RANGES.some((range) => range.test(mappedIpv4 || normalizedAddress));
  }

  return PRIVATE_IPV6_RANGES.some((range) => range.test(normalizedAddress));
};

// Rejects localhost and any hostname that resolves to a private, loopback,
// link-local, or multicast address so the proxy can't reach internal services.
const isBlockedUrl = async (url: URL) => {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return true;
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true;
  }

  if (isIP(hostname)) {
    return isPrivateAddress(hostname);
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address));
  } catch {
    return true;
  }
};

// Follows redirects manually so every hop goes through the same address checks.
const fetchUpstream = async (startUrl: URL, userAgent: string) => {
  let currentUrl = startUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (await isBlockedUrl(currentUrl)) {
      return null;
    }

    const response = await fetch(currentUrl.toString(), {
      headers: { 'User-Agent': userAgent },
      redirect: 'manual',
    });
    const location = response.headers.get('location');

    if (response.status < 300 || response.status >= 400 || !location) {
      return { response, url: currentUrl };
    }

    currentUrl = new URL(location, currentUrl);
  }

  return null;
};

const resolvePlaylistUrl = (value: string, baseUrl: string) => {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const rewritePlaylist = (playlist: string, baseUrl: string) =>
  playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        return line;
      }

      if (trimmedLine.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const resolvedUrl = resolvePlaylistUrl(uri, baseUrl);
          return `URI="${getProxyUrl(resolvedUrl)}"`;
        });
      }

      return getProxyUrl(resolvePlaylistUrl(trimmedLine, baseUrl));
    })
    .join('\n');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const urlParam = req.query.url;
  const targetUrl = Array.isArray(urlParam) ? urlParam[0] : urlParam;

  if (!targetUrl) {
    return res.status(400).json({ message: 'Missing stream URL' });
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(unwrapExternalProxyUrl(targetUrl));
  } catch {
    return res.status(400).json({ message: 'Invalid stream URL' });
  }

  try {
    const upstream = await fetchUpstream(
      parsedUrl,
      req.headers['user-agent'] ||
        'Mozilla/5.0 (compatible; ImpactStream/1.0; +https://impactstream.vercel.app)'
    );

    if (!upstream) {
      return res.status(400).json({ message: 'Unsupported stream URL' });
    }

    const { response: upstreamResponse, url: finalUrl } = upstream;

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({ message: 'Failed to fetch stream' });
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isPlaylist =
      contentType.includes('mpegurl') ||
      contentType.includes('vnd.apple.mpegurl') ||
      finalUrl.pathname.toLowerCase().endsWith('.m3u8');

    res.setHeader('Cache-Control', isPlaylist ? 'no-store' : 'public, max-age=30');

    if (isPlaylist) {
      const playlist = await upstreamResponse.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(200).send(rewritePlaylist(playlist, finalUrl.toString()));
    }

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (!upstreamResponse.body) {
      return res.status(502).json({ message: 'Empty stream response' });
    }

    res.status(200);
    Readable.fromWeb(upstreamResponse.body as any).pipe(res);
  } catch (error) {
    console.error('Error proxying stream:', error);
    res.status(502).json({ message: 'Failed to proxy stream' });
  }
}
