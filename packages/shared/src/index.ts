export const APP_NAME = "ImpactStream";

export type MediaKind = "movie" | "tv" | "anime" | "live-tv";

export type MediaSummary = {
  id: string | number;
  kind: MediaKind;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
};

export type PlaybackSource = {
  url: string;
  quality?: string;
  mimeType?: string;
};

export type ImpactStreamApiConfig = {
  baseUrl: string;
};

export function createApiUrl(
  config: ImpactStreamApiConfig,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(path, config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}
