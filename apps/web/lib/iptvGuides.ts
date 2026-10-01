export type IptvGuide = {
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

// Most guides.json entries only name a scraping site; this returns a URL only
// when there is an XMLTV document we can actually download.
export const getGuideSourceUrl = (guide: IptvGuide) =>
  getSourceUrl(guide) || getDerivedSourceUrl(guide);
