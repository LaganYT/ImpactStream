import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'stream';

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

const getProxyUrl = (url: string) => `/api/stream-proxy?url=${encodeURIComponent(url)}`;

const isBlockedHostname = (hostname: string) => {
  const normalizedHostname = hostname.toLowerCase();

  if (normalizedHostname === 'localhost' || normalizedHostname.endsWith('.localhost')) {
    return true;
  }

  return PRIVATE_IPV4_RANGES.some((range) => range.test(normalizedHostname));
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
    parsedUrl = new URL(targetUrl);
  } catch {
    return res.status(400).json({ message: 'Invalid stream URL' });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || isBlockedHostname(parsedUrl.hostname)) {
    return res.status(400).json({ message: 'Unsupported stream URL' });
  }

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          req.headers['user-agent'] ||
          'Mozilla/5.0 (compatible; ImpactStream/1.0; +https://impactstream.vercel.app)',
      },
    });

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({ message: 'Failed to fetch stream' });
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isPlaylist =
      contentType.includes('mpegurl') ||
      contentType.includes('vnd.apple.mpegurl') ||
      parsedUrl.pathname.toLowerCase().endsWith('.m3u8');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', isPlaylist ? 'no-store' : 'public, max-age=30');

    if (isPlaylist) {
      const playlist = await upstreamResponse.text();
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(200).send(rewritePlaylist(playlist, parsedUrl.toString()));
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
