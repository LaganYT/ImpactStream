/** Client-side Videasy URL and HLS helpers (aligned with authorized_playback_screen.dart). */

export const VIDEOASY_SOURCE_UI_LABELS = [
  "Auto",
  "Neon",
  "Yoru",
  "Cypher",
  "Sage",
  "Jett",
  "Reyna",
  "Breach",
  "Vyse",
] as const;

export type VideasySourceUiLabel = (typeof VIDEOASY_SOURCE_UI_LABELS)[number];

export type StreamQuality = {
  label: string;
  url: string;
  bandwidth: number;
};

export function isM3u8Url(value: string): boolean {
  const uri = new URL(value, "https://player.videasy.net/");
  const hay = `${uri.pathname}${uri.search}`;
  return /\.m3u8(?:[?#]|$)/i.test(hay);
}

export function normalizeVideasyUrl(input: string): string {
  const trimmed = input.trim();
  const uri = new URL(trimmed);
  if (uri.protocol !== "https:") {
    throw new Error("Only HTTPS Videasy links are supported.");
  }

  if (isM3u8Url(trimmed)) {
    return uri.href.split("#")[0];
  }

  const host = uri.hostname.toLowerCase();
  if (host !== "player.videasy.net" && host !== "videasy.net" && host !== "www.videasy.net") {
    throw new Error(`Unsupported Videasy host: ${uri.host}.`);
  }

  if (host === "videasy.net" || host === "www.videasy.net") {
    const path = uri.pathname.replace(/^\/+/, "");
    if (!path.startsWith("movie/") && !path.startsWith("tv/")) {
      throw new Error("Videasy links must start with /movie/... or /tv/...");
    }
    const next = new URL(`https://player.videasy.net/${path}`);
    uri.searchParams.forEach((v, k) => next.searchParams.set(k, v));
    return next.href.split("#")[0];
  }

  if (
    !uri.pathname.startsWith("/movie/") &&
    !uri.pathname.startsWith("/tv/") &&
    !uri.pathname.startsWith("/anime/")
  ) {
    throw new Error("Unsupported Videasy player path.");
  }

  return uri.href.split("#")[0];
}

export function withResolutionCacheBuster(value: string): string {
  if (isM3u8Url(value)) {
    return value;
  }
  const uri = new URL(value);
  uri.searchParams.set("_impactstreamResolve", String(Date.now() * 1000 + Math.floor(Math.random() * 1000)));
  return uri.toString();
}

export function parseTvSeasonEpisodeFromUrl(streamUrl: string): { season: number; episode: number } | null {
  const match = streamUrl.match(/\/tv\/\d+\/(\d+)\/(\d+)/);
  if (!match) return null;
  const season = Number(match[1]);
  const episode = Number(match[2]);
  if (!Number.isFinite(season) || season < 1 || !Number.isFinite(episode) || episode < 1) return null;
  return { season, episode };
}

function findQuality(
  qualities: StreamQuality[],
  test: (q: StreamQuality) => boolean
): StreamQuality | null {
  for (const q of qualities) {
    if (test(q)) return q;
  }
  return null;
}

export function parseMasterPlaylistQualities(playlist: string, baseUrl: string): StreamQuality[] {
  const lines = playlist.split(/\r?\n/);
  const qualities: StreamQuality[] = [];
  const base = new URL(baseUrl);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;

    const bandwidth = Number(RegExp(/BANDWIDTH=(\d+)/).exec(line)?.[1] || 0) || 0;
    const resolution = RegExp(/RESOLUTION=(\d+x\d+)/).exec(line)?.[1];
    let uriMatch = RegExp(/URI="([^"]+)"/).exec(line)?.[1];
    let child: string | undefined = uriMatch;

    if (child == null) {
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j].trim();
        if (next === "") continue;
        if (next.startsWith("#")) break;
        child = next;
        break;
      }
    }

    if (child == null) continue;

    const label =
      resolution != null
        ? `${resolution.split("x").pop()}p`
        : bandwidth > 0
          ? `${(bandwidth / 1_000_000).toFixed(1)} Mbps`
          : `Variant ${qualities.length + 1}`;

    qualities.push({
      label,
      url: new URL(child, base).href.split("#")[0],
      bandwidth,
    });
  }

  qualities.sort((a, b) => b.bandwidth - a.bandwidth);
  const seenLabels: Record<string, number> = {};
  return qualities.map((quality) => {
    const count = (seenLabels[quality.label] ?? 0) + 1;
    seenLabels[quality.label] = count;
    if (count === 1) return quality;
    return { ...quality, label: `${quality.label} #${count}` };
  });
}

export async function fetchPlaylistText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "*/*",
      Origin: "https://player.videasy.net",
      Referer: "https://player.videasy.net/",
    },
  });
  if (!res.ok) {
    throw new Error(`Playlist request failed with ${res.status}.`);
  }
  const text = await res.text();
  const body = text.trimStart();
  if (!body.startsWith("#EXTM3U")) {
    throw new Error(`Expected an HLS playlist from ${url}.`);
  }
  return text;
}

export function selectPlaybackQualityUrl(
  m3u8Url: string,
  playlistText: string,
  selectedQualityUrl: string | null,
  selectedQualityLabel: string | null
): { playbackUrl: string; qualities: StreamQuality[]; effective: StreamQuality | null } {
  const qualities = parseMasterPlaylistQualities(playlistText, m3u8Url);
  const byUrl = selectedQualityUrl
    ? findQuality(qualities, (q) => q.url === selectedQualityUrl)
    : null;
  const byLabel = selectedQualityLabel
    ? findQuality(qualities, (q) => q.label === selectedQualityLabel)
    : null;
  const effective = byUrl ?? byLabel ?? (qualities.length ? qualities[0] : null);
  const playbackUrl = effective?.url ?? m3u8Url;
  return { playbackUrl, qualities, effective };
}

export function pickSourceUrlByUiLabel(
  sources: { url: string; quality?: string }[],
  label: VideasySourceUiLabel | string
): string | null {
  if (!sources.length) return null;
  if (label === "Auto") return sources[0].url;

  const needle = String(label).toLowerCase();
  const byName = sources.find((s) => (s.quality || "").toLowerCase().includes(needle));
  return (byName ?? sources[0]).url;
}
