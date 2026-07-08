import type { NextApiRequest, NextApiResponse } from 'next';

type CsvRow = Record<string, string>;

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
};

const IPTV_ORG_DATA_BASE = 'https://raw.githubusercontent.com/iptv-org/database/master/data';
const IPTV_ORG_STREAMS_URL = 'https://iptv-org.github.io/api/streams.json';

const parseCsv = (csv: string): CsvRow[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((currentRow) =>
    currentRow.some((cell) => cell.trim())
  );

  return dataRows.map((dataRow) =>
    headers.reduce<CsvRow>((record, header, index) => {
      record[header] = dataRow[index] || '';
      return record;
    }, {})
  );
};

const fetchText = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.text();
};

const splitList = (value: string | undefined) =>
  (value || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);

const toCountryCode = (country: string) => country.trim().toUpperCase();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const [channelsCsv, feedsCsv, logosCsv, streamsResponse] = await Promise.all([
      fetchText(`${IPTV_ORG_DATA_BASE}/channels.csv`),
      fetchText(`${IPTV_ORG_DATA_BASE}/feeds.csv`),
      fetchText(`${IPTV_ORG_DATA_BASE}/logos.csv`),
      fetch(IPTV_ORG_STREAMS_URL),
    ]);

    if (!streamsResponse.ok) {
      throw new Error('Failed to fetch iptv-org streams');
    }

    const channelRows = parseCsv(channelsCsv);
    const feedRows = parseCsv(feedsCsv);
    const logoRows = parseCsv(logosCsv);
    const streams = (await streamsResponse.json()) as IptvStream[];

    const feedLanguagesByChannel = new Map<string, string[]>();
    const streamsByChannel = new Map<string, IptvStream[]>();
    const logosByChannel = new Map<string, string>();

    feedRows.forEach((feed) => {
      const channelId = feed.channel;
      if (!channelId) return;

      const languages = splitList(feed.languages);
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

    streams.forEach((stream) => {
      if (!stream.channel || !stream.url) return;

      const channelStreams = streamsByChannel.get(stream.channel) || [];
      channelStreams.push(stream);
      streamsByChannel.set(stream.channel, channelStreams);
    });

    const validChannels = channelRows.reduce<LiveTvChannel[]>((channels, channel) => {
      const channelId = channel.id;
      const channelStreams = streamsByChannel.get(channelId) || [];
      if (!channelId || channelStreams.length === 0 || channel.is_nsfw === 'TRUE') {
        return channels;
      }

      const languages = feedLanguagesByChannel.get(channelId) || [];
      const streamUrls = Array.from(new Set(channelStreams.map((stream) => stream.url)));
      const country = toCountryCode(channel.country);

      channels.push({
        nanoid: channelId,
        name: channel.name,
        iptv_urls: streamUrls,
        youtube_urls: [],
        language: languages[0] || '',
        languages,
        country,
        category: 'Live TV',
        isGeoBlocked: channelStreams.some((stream) =>
          (stream.label || '').toLowerCase().includes('geo-blocked')
        ),
        stream_urls: streamUrls,
        logo: logosByChannel.get(channelId),
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
