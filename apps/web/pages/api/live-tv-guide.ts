import type { NextApiRequest, NextApiResponse } from 'next';

import { getGuideSourceUrl, IptvGuide } from '../../lib/iptvGuides';

type GuideProgram = {
  channel: string;
  title: string;
  description: string;
  start: string;
  stop: string;
  category: string;
};

const IPTV_ORG_GUIDES_URL = 'https://iptv-org.github.io/api/guides.json';
const GUIDE_INDEX_TTL_MS = 60 * 60 * 1000;
const MAX_PROGRAMS_PER_CHANNEL = 30;
const MAX_BATCH_CHANNELS = 20;

type ChannelGuideResult = {
  guides: IptvGuide[];
  programs: GuideProgram[];
};

// guides.json is ~25 MB, so keep the per-channel index in memory between
// requests on a warm instance instead of downloading it every time.
let guideIndexCache: { expiresAt: number; byChannel: Map<string, IptvGuide[]> } | null = null;

const getGuideIndex = async () => {
  if (guideIndexCache && guideIndexCache.expiresAt > Date.now()) {
    return guideIndexCache.byChannel;
  }

  const byChannel = new Map<string, IptvGuide[]>();
  for (const guide of await fetchJson<IptvGuide[]>(IPTV_ORG_GUIDES_URL)) {
    if (!guide.channel) continue;
    const channelGuides = byChannel.get(guide.channel) || [];
    channelGuides.push(guide);
    byChannel.set(guide.channel, channelGuides);
  }

  guideIndexCache = { expiresAt: Date.now() + GUIDE_INDEX_TTL_MS, byChannel };
  return byChannel;
};

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

// Parses an XMLTV document once and buckets upcoming programmes by requested channel.
const parseXmlTvPrograms = (xml: string, channelIdSets: Map<string, Set<string>>) => {
  const programsByChannel = new Map<string, GuideProgram[]>();
  const programmePattern = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi;
  const now = Date.now();
  let match: RegExpExecArray | null;

  while ((match = programmePattern.exec(xml)) !== null) {
    const attributes = match[1];
    const channelMatch = attributes.match(/channel="([^"]+)"/i);
    const channel = channelMatch ? decodeXml(channelMatch[1]) : '';
    if (!channel) continue;

    const requestedChannels = Array.from(channelIdSets.entries())
      .filter(([, channelIds]) => matchesProgramChannel(channel, channelIds))
      .map(([requestedChannel]) => requestedChannel);
    if (requestedChannels.length === 0) continue;

    const startMatch = attributes.match(/start="([^"]+)"/i);
    const stopMatch = attributes.match(/stop="([^"]+)"/i);
    const start = startMatch ? parseXmlTvDate(startMatch[1]) : '';
    const stop = stopMatch ? parseXmlTvDate(stopMatch[1]) : '';

    // EPG files often start days in the past; only keep what hasn't finished.
    if (!start || (stop && new Date(stop).getTime() <= now)) continue;

    const body = match[2];
    const program: GuideProgram = {
      channel,
      title: getXmlText(body, 'title') || 'Untitled',
      description: getXmlText(body, 'desc'),
      start,
      stop,
      category: getXmlText(body, 'category'),
    };

    for (const requestedChannel of requestedChannels) {
      const programs = programsByChannel.get(requestedChannel) || [];
      programs.push(program);
      programsByChannel.set(requestedChannel, programs);
    }
  }

  programsByChannel.forEach((programs, channel) => {
    programsByChannel.set(
      channel,
      programs.sort((a, b) => a.start.localeCompare(b.start)).slice(0, MAX_PROGRAMS_PER_CHANNEL)
    );
  });

  return programsByChannel;
};


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

// Resolves guides for several channels, downloading each EPG source at most
// once. A channel falls through to its next source only if earlier ones had
// no programmes for it.
const loadChannelGuides = async (channelIds: string[]) => {
  const guideIndex = await getGuideIndex();
  const results = new Map<string, ChannelGuideResult>(
    channelIds.map((channelId) => [channelId, { guides: guideIndex.get(channelId) || [], programs: [] }])
  );
  const fetchedSources = new Map<string, string | null>();
  const maxGuides = Math.max(0, ...channelIds.map((channelId) => results.get(channelId)!.guides.length));

  for (let attempt = 0; attempt < maxGuides; attempt += 1) {
    const pendingBySource = new Map<string, Map<string, Set<string>>>();

    for (const channelId of channelIds) {
      const result = results.get(channelId)!;
      if (result.programs.length > 0) continue;

      const sourceGuide = result.guides.filter((guide) => getGuideSourceUrl(guide))[attempt];
      const sourceUrl = sourceGuide && getGuideSourceUrl(sourceGuide);
      if (!sourceGuide || !sourceUrl) continue;

      const channelSets = pendingBySource.get(sourceUrl) || new Map<string, Set<string>>();
      channelSets.set(channelId, getGuideChannelIds(channelId, sourceGuide));
      pendingBySource.set(sourceUrl, channelSets);
    }

    if (pendingBySource.size === 0) break;

    await Promise.all(
      Array.from(pendingBySource.entries()).map(async ([sourceUrl, channelSets]) => {
        if (!fetchedSources.has(sourceUrl)) {
          try {
            const response = await fetch(sourceUrl);
            fetchedSources.set(sourceUrl, response.ok ? await response.text() : null);
          } catch {
            fetchedSources.set(sourceUrl, null);
          }
        }

        const xml = fetchedSources.get(sourceUrl);
        if (!xml) return;

        parseXmlTvPrograms(xml, channelSets).forEach((programs, channelId) => {
          results.get(channelId)!.programs = programs;
        });
      })
    );
  }

  return results;
};

const toGuideSummary = (guide: IptvGuide) => ({
  feed: guide.feed,
  site: guide.site,
  siteId: guide.site_id,
  siteName: guide.site_name,
  language: guide.lang,
  hasSource: Boolean(getGuideSourceUrl(guide)),
});

const firstQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const channelId = firstQueryValue(req.query.channel);
  const batchParam = firstQueryValue(req.query.channels);
  const batchChannelIds = Array.from(
    new Set((batchParam || '').split(',').map((value) => value.trim()).filter(Boolean))
  ).slice(0, MAX_BATCH_CHANNELS);

  if (!channelId && batchChannelIds.length === 0) {
    return res.status(400).json({ message: 'Missing channel id' });
  }

  try {
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

    if (channelId) {
      const result = (await loadChannelGuides([channelId])).get(channelId)!;
      return res.status(200).json({
        channel: channelId,
        guides: result.guides.map(toGuideSummary),
        programs: result.programs,
      });
    }

    const results = await loadChannelGuides(batchChannelIds);
    return res.status(200).json({
      channels: Object.fromEntries(
        batchChannelIds.map((id) => [id, { programs: results.get(id)!.programs }])
      ),
    });
  } catch (error) {
    console.error('Error fetching live TV guide:', error);
    res.status(500).json({ message: 'Failed to fetch guide' });
  }
}
