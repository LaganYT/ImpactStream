import type { NextApiRequest, NextApiResponse } from 'next';

type IptvStream = {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  quality: string | null;
  label: string | null;
  user_agent: string | null;
  referrer: string | null;
};

type IptvChannel = {
  id: string;
  name: string;
  country: string;
  categories: string[];
  is_nsfw: boolean;
};

type IptvFeed = {
  channel: string;
  id: string;
  is_main: boolean;
  languages: string[];
};

type IptvLogo = {
  channel: string;
  feed: string | null;
  in_use: boolean;
  url: string;
};

type IptvGuide = {
  channel: string | null;
  feed: string | null;
  site: string;
  site_id: string;
  site_name: string;
  lang: string;
  sources: {
    host: string;
    url: string;
    format: string;
  }[];
};

type LiveTvChannel = {
  nanoid: string;
  name: string;
  iptv_urls: string[];
  youtube_urls: string[];
  language: string;
  languages: string[];
  country: string;
  category?: string;
  isGeoBlocked: boolean;
  stream_urls: string[];
  logo?: string;
  hasGuide: boolean;
  guideCount: number;
  guideSites: string[];
  guideLanguages: string[];
};

const IPTV_ORG_API_BASE = 'https://iptv-org.github.io/api';
const IPTV_ORG_STREAMS_URL = 'https://iptv-org.github.io/api/streams.json';
const EXTERNAL_PROXY_HOSTS = new Set(['cors-proxy.cooks.fyi']);
const CHANNEL_STREAM_OVERRIDES: Record<string, { preferred: string[]; blocked: string[] }> = {
  'DisneyChannel.us': {
    preferred: ['http://206.212.244.63/650/index.m3u8'],
    blocked: ['http://212.5.144.156:8080/disney/index.m3u8'],
  },
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json() as Promise<T>;
};

const toCountryCode = (country: string) => country.trim().toUpperCase();

const getLocalProxyUrl = (url: string) => `/api/stream-proxy?url=${encodeURIComponent(url)}`;

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

const normalizeStreamUrl = (url: string) => {
  const unwrappedUrl = unwrapExternalProxyUrl(url);

  if (unwrappedUrl !== url) {
    return getLocalProxyUrl(unwrappedUrl);
  }

  return url;
};

const getStreamUrls = (channelId: string, channelStreams: IptvStream[]) => {
  const override = CHANNEL_STREAM_OVERRIDES[channelId];
  const blockedUrls = new Set((override?.blocked || []).map(unwrapExternalProxyUrl));
  const upstreamUrls = channelStreams
    .map((stream) => unwrapExternalProxyUrl(stream.url))
    .filter((url) => !blockedUrls.has(url));

  return Array.from(new Set([...(override?.preferred || []), ...upstreamUrls].map(normalizeStreamUrl)));
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const [channelRows, feedRows, logoRows, guideRows, streams] = await Promise.all([
      fetchJson<IptvChannel[]>(`${IPTV_ORG_API_BASE}/channels.json`),
      fetchJson<IptvFeed[]>(`${IPTV_ORG_API_BASE}/feeds.json`),
      fetchJson<IptvLogo[]>(`${IPTV_ORG_API_BASE}/logos.json`),
      fetchJson<IptvGuide[]>(`${IPTV_ORG_API_BASE}/guides.json`),
      fetchJson<IptvStream[]>(IPTV_ORG_STREAMS_URL),
    ]);

    const feedLanguagesByChannel = new Map<string, string[]>();
    const streamsByChannel = new Map<string, IptvStream[]>();
    const logosByChannel = new Map<string, string>();
    const guidesByChannel = new Map<string, IptvGuide[]>();

    feedRows.forEach((feed) => {
      const channelId = feed.channel;
      if (!channelId) return;

      const languages = feed.languages || [];
      if (languages.length > 0 && !feedLanguagesByChannel.has(channelId)) {
        feedLanguagesByChannel.set(channelId, languages);
      }
    });

    logoRows.forEach((logo) => {
      const channelId = logo.channel;
      const url = logo.url;
      if (channelId && url && !logosByChannel.has(channelId)) {
        logosByChannel.set(channelId, url);
      }
    });

    guideRows.forEach((guide) => {
      if (!guide.channel) return;

      const channelGuides = guidesByChannel.get(guide.channel) || [];
      channelGuides.push(guide);
      guidesByChannel.set(guide.channel, channelGuides);
    });

    streams.forEach((stream) => {
      if (!stream.channel || !stream.url) return;

      const channelStreams = streamsByChannel.get(stream.channel) || [];
      channelStreams.push(stream);
      streamsByChannel.set(stream.channel, channelStreams);
    });

    const validChannels = channelRows.reduce<LiveTvChannel[]>((channels, channel) => {
      const channelId = channel.id;
      const channelStreams = streamsByChannel.get(channelId) || [];
      if (!channelId || channelStreams.length === 0 || channel.is_nsfw) {
        return channels;
      }

      const languages = feedLanguagesByChannel.get(channelId) || [];
      const streamUrls = getStreamUrls(channelId, channelStreams);
      const country = toCountryCode(channel.country);
      const guides = guidesByChannel.get(channelId) || [];
      const guideSites = Array.from(new Set(guides.map((guide) => guide.site))).sort();
      const guideLanguages = Array.from(new Set(guides.map((guide) => guide.lang))).sort();

      channels.push({
        nanoid: channelId,
        name: channel.name,
        iptv_urls: streamUrls,
        youtube_urls: [],
        language: languages[0] || '',
        languages,
        country,
        category: channel.categories?.[0] || 'Live TV',
        isGeoBlocked: channelStreams.some((stream) =>
          (stream.label || '').toLowerCase().includes('geo-blocked')
        ),
        stream_urls: streamUrls,
        logo: logosByChannel.get(channelId),
        hasGuide: guides.length > 0,
        guideCount: guides.length,
        guideSites,
        guideLanguages,
      });

      return channels;
    }, []);

    res
      .setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
      .status(200)
      .json(validChannels);
  } catch (error) {
    console.error('Error fetching live TV channels:', error);
    res.status(500).json({ message: 'Failed to fetch channels' });
  }
}
