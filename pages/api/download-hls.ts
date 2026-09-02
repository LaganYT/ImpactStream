import type { NextApiRequest, NextApiResponse } from 'next';
import { once } from 'events';

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

const isBlockedHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    PRIVATE_IPV4_RANGES.some((range) => range.test(normalized))
  );
};

const validateRemoteUrl = (value: string) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || isBlockedHostname(url.hostname)) {
    throw new Error('Unsupported stream URL');
  }
  return url;
};

const absoluteUrl = (value: string, base: string) => new URL(value, base).toString();

const fetchText = async (url: string, signal: AbortSignal) => {
  const response = await fetch(validateRemoteUrl(url), {
    signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImpactStream/1.0)' },
  });
  if (!response.ok) throw new Error(`Playlist request failed (${response.status})`);
  return response.text();
};

async function selectMediaPlaylist(url: string, signal: AbortSignal) {
  const manifest = await fetchText(url, signal);
  const lines = manifest.split(/\r?\n/);
  if (!lines.some((line) => line.startsWith('#EXT-X-STREAM-INF'))) {
    return { url, manifest };
  }

  let best: { bandwidth: number; url: string } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF')) continue;
    const bandwidth = Number(lines[index].match(/BANDWIDTH=(\d+)/)?.[1] || 0);
    const uri = lines.slice(index + 1).find((line) => line && !line.startsWith('#'));
    if (uri && (!best || bandwidth > best.bandwidth)) {
      best = { bandwidth, url: absoluteUrl(uri, url) };
    }
  }

  if (!best) throw new Error('No downloadable HLS variant was found');
  return { url: best.url, manifest: await fetchText(best.url, signal) };
}

type DownloadPart = { url: string; range?: string };

function parseParts(manifest: string, playlistUrl: string) {
  const parts: DownloadPart[] = [];
  let pendingRange: string | undefined;

  for (const line of manifest.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const map = trimmed.match(/^#EXT-X-MAP:.*URI="([^"]+)"/);
    if (map) {
      parts.push({ url: absoluteUrl(map[1], playlistUrl) });
      continue;
    }

    if (trimmed.startsWith('#EXT-X-BYTERANGE:')) {
      const value = trimmed.slice('#EXT-X-BYTERANGE:'.length);
      const [lengthText, offsetText] = value.split('@');
      const length = Number(lengthText);
      const offset = offsetText == null ? null : Number(offsetText);
      if (Number.isFinite(length) && length > 0 && offset != null && Number.isFinite(offset)) {
        pendingRange = `bytes=${offset}-${offset + length - 1}`;
      } else {
        // Relative byte ranges require tracking the previous end offset. They are rare in
        // the streams used by ImpactStream, so fail rather than silently corrupt a file.
        throw new Error('This HLS stream uses unsupported relative byte ranges');
      }
      continue;
    }

    if (trimmed.startsWith('#')) continue;
    parts.push({ url: absoluteUrl(trimmed, playlistUrl), range: pendingRange });
    pendingRange = undefined;
  }

  return parts;
}

function safeFilename(value: string) {
  return (value || 'video')
    .replace(/[\\/:*?"<>|\r\n]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'video';
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  const rawName = Array.isArray(req.query.filename) ? req.query.filename[0] : req.query.filename;
  if (!rawUrl) return res.status(400).json({ message: 'Missing stream URL' });

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    validateRemoteUrl(rawUrl);
    const selected = await selectMediaPlaylist(rawUrl, controller.signal);

    if (!selected.manifest.includes('#EXT-X-ENDLIST')) {
      return res.status(400).json({ message: 'Live or unfinished streams cannot be downloaded' });
    }
    if (selected.manifest.includes('#EXT-X-KEY')) {
      return res.status(400).json({ message: 'Encrypted HLS streams are not supported' });
    }

    const parts = parseParts(selected.manifest, selected.url);
    if (!parts.length) return res.status(400).json({ message: 'The playlist contains no media parts' });

    const firstPath = new URL(parts[0].url).pathname.toLowerCase();
    const fragmentedMp4 = firstPath.endsWith('.mp4') || firstPath.endsWith('.m4s') || selected.manifest.includes('#EXT-X-MAP');
    const extension = fragmentedMp4 ? 'mp4' : 'ts';
    const filename = `${safeFilename(rawName || 'video')}.${extension}`;

    res.statusCode = 200;
    res.setHeader('Content-Type', fragmentedMp4 ? 'video/mp4' : 'video/mp2t');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    for (const part of parts) {
      const headers: Record<string, string> = {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (compatible; ImpactStream/1.0)',
      };
      if (part.range) headers.Range = part.range;

      const upstream = await fetch(validateRemoteUrl(part.url), {
        signal: controller.signal,
        headers,
      });
      if (!upstream.ok || !upstream.body) {
        throw new Error(`A video part failed (${upstream.status})`);
      }

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) await once(res, 'drain');
      }
    }

    res.end();
  } catch (error) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }

    console.error('HLS download failed:', error);
    if (!res.headersSent) {
      return res.status(502).json({
        message: error instanceof Error ? error.message : 'Failed to download stream',
      });
    }
    res.destroy(error instanceof Error ? error : undefined);
  }
}
