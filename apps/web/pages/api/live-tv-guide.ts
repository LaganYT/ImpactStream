import type { NextApiRequest, NextApiResponse } from 'next';

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

type GuideProgram = {
  channel: string;
  title: string;
  description: string;
  start: string;
  stop: string;
  category: string;
};

const IPTV_ORG_GUIDES_URL = 'https://iptv-org.github.io/api/guides.json';

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json() as Promise<T>;
};

const decodeXml = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const getXmlText = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
};

const parseXmlTvDate = (value: string) => {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) return value;

  const [, year, month, day, hour, minute, second, offset = '+0000'] = match;
  const normalizedOffset = `${offset.slice(0, 3)}:${offset.slice(3, 5)}`;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${normalizedOffset}`).toISOString();
};

const matchesProgramChannel = (channel: string, channelIds: Set<string>) => {
  if (channelIds.has(channel)) {
    return true;
  }

  return Array.from(channelIds).some((id) => id.startsWith('-') && channel.endsWith(id));
};

const parseXmlTvPrograms = (xml: string, channelIds: Set<string>) => {
  const programs: GuideProgram[] = [];
  const programmePattern = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match: RegExpExecArray | null;

  while ((match = programmePattern.exec(xml)) !== null) {
    const attributes = match[1];
    const body = match[2];
    const channelMatch = attributes.match(/channel="([^"]+)"/i);
    const startMatch = attributes.match(/start="([^"]+)"/i);
    const stopMatch = attributes.match(/stop="([^"]+)"/i);
    const channel = channelMatch ? decodeXml(channelMatch[1]) : '';

    if (!channel || !matchesProgramChannel(channel, channelIds)) {
      continue;
    }

    programs.push({
      channel,
      title: getXmlText(body, 'title') || 'Untitled',
      description: getXmlText(body, 'desc'),
      start: startMatch ? parseXmlTvDate(startMatch[1]) : '',
      stop: stopMatch ? parseXmlTvDate(stopMatch[1]) : '',
      category: getXmlText(body, 'category'),
    });
  }

  return programs
    .filter((program) => program.start)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 30);
};

const getSourceUrl = (guide: IptvGuide) =>
  guide.sources.find((source) => source.format === 'XML')?.url ||
  guide.sources.find((source) => source.format === 'JSON')?.url ||
  guide.sources[0]?.url;

const getDerivedSourceUrl = (guide: IptvGuide) => {
  if (guide.site !== 'i.mjh.nz') {
    return undefined;
  }

  const [sourcePath] = guide.site_id.split('#');
  return sourcePath ? `https://i.mjh.nz/${sourcePath}.xml` : undefined;
};

const getGuideSourceUrl = (guide: IptvGuide) => getSourceUrl(guide) || getDerivedSourceUrl(guide);

const getGuideChannelIds = (channelId: string, guide: IptvGuide) => {
  const [, guideChannelId = guide.site_id] = guide.site_id.split('#');
  const suffix = guideChannelId.includes('-') ? guideChannelId.slice(guideChannelId.lastIndexOf('-')) : '';

  return new Set([
    channelId,
    guide.site_id,
    guide.site_name,
    guideChannelId,
    suffix,
    `${guide.channel}@${guide.feed}`,
    `${guide.channel}.${guide.feed || 'SD'}`,
  ].filter(Boolean));
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const channelParam = req.query.channel;
  const channelId = Array.isArray(channelParam) ? channelParam[0] : channelParam;

  if (!channelId) {
    return res.status(400).json({ message: 'Missing channel id' });
  }

  try {
    const guides = (await fetchJson<IptvGuide[]>(IPTV_ORG_GUIDES_URL)).filter(
      (guide) => guide.channel === channelId
    );
    const sourceGuides = guides.filter((guide) => getGuideSourceUrl(guide));
    let programs: GuideProgram[] = [];

    for (const sourceGuide of sourceGuides) {
      const sourceUrl = getGuideSourceUrl(sourceGuide);

      if (sourceUrl) {
        const response = await fetch(sourceUrl);
        if (response.ok) {
          const text = await response.text();
          const channelIds = getGuideChannelIds(channelId, sourceGuide);
          programs = parseXmlTvPrograms(text, channelIds);
          if (programs.length > 0) {
            break;
          }
        }
      }
    }

    res
      .setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
      .status(200)
      .json({
        channel: channelId,
        guides: guides.map((guide) => ({
          feed: guide.feed,
          site: guide.site,
          siteId: guide.site_id,
          siteName: guide.site_name,
          language: guide.lang,
          hasSource: Boolean(getGuideSourceUrl(guide)),
        })),
        programs,
      });
  } catch (error) {
    console.error('Error fetching live TV guide:', error);
    res.status(500).json({ message: 'Failed to fetch guide' });
  }
}
