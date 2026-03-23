import type { NextApiRequest, NextApiResponse } from 'next';

type RawChannel = {
  stream_urls?: string[];
  iptv_urls?: string[];
  youtube_urls?: string[];
  languages?: string[];
  language?: string;
  [key: string]: unknown;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/famelack/famelack-data/refs/heads/main/tv/raw/countries/us.json'
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch channels');
    }

    const channels = (await response.json()) as RawChannel[];

    const normalizedChannels = channels.map((channel) => {
      const streamUrls = Array.isArray(channel.stream_urls) ? channel.stream_urls : [];
      const legacyIptvUrls = Array.isArray(channel.iptv_urls) ? channel.iptv_urls : [];
      const youtubeUrls = Array.isArray(channel.youtube_urls) ? channel.youtube_urls : [];

      return {
        ...channel,
        stream_urls: streamUrls.length > 0 ? streamUrls : legacyIptvUrls,
        iptv_urls: legacyIptvUrls.length > 0 ? legacyIptvUrls : streamUrls,
        youtube_urls: youtubeUrls,
      };
    });

    const allowedLanguages = new Set(['eng', 'en', 'english', 'spa', 'es', 'spanish']);

    // Keep channels that provide stream/YouTube sources and are English or Spanish.
    const validChannels = normalizedChannels.filter(
      (channel) => {
        const hasPlayableSource = channel.iptv_urls.length > 0 || channel.youtube_urls.length > 0;
        const langList = [
          ...(Array.isArray(channel.languages) ? channel.languages : []),
          ...(typeof channel.language === 'string' ? [channel.language] : []),
        ]
          .map((lang) => lang.toLowerCase().trim())
          .filter(Boolean);

        const isEnglishOrSpanish = langList.some((lang) => allowedLanguages.has(lang));

        return hasPlayableSource && isEnglishOrSpanish;
      }
    );

    res.status(200).json(validChannels);
  } catch (error) {
    console.error('Error fetching live TV channels:', error);
    res.status(500).json({ message: 'Failed to fetch channels' });
  }
}
