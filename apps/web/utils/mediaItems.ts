import type { CardShape, MediaRowItem } from "../components/MediaRow";
import type { PosterGridItem } from "../components/PosterGrid";
import type { TitleRef } from "../components/TitleModal";
import { getMediaType, isAnimeItem, RoutableMediaItem } from "./mediaRouting";
import { posterUrl } from "./posters";
import { TMDB_IMAGE_BASE_URL } from "./tmdbClient";

// A movie or TV result as returned by TMDB list endpoints (search, discover, trending).
export type TmdbListItem = RoutableMediaItem & {
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity?: number;
};

export type TmdbPage<T = TmdbListItem> = {
  page: number;
  results?: T[];
  total_pages?: number;
  total_results?: number;
};

export const mediaItemKey = (item: TmdbListItem) => `${getMediaType(item)}-${item.id}`;

export function toPosterGridItem(item: TmdbListItem): PosterGridItem {
  return {
    key: mediaItemKey(item),
    title: getTitle(item),
    posterUrl: posterUrl(item.poster_path),
    label: typeLabel(item),
    year: getYear(item),
    rating: item.vote_average,
  };
}

export const toTitleRef = (item: TmdbListItem): TitleRef => ({
  id: item.id,
  mediaType: getMediaType(item),
  isAnime: isAnimeItem(item),
});

// Merges a new page of results, dropping titles already shown.
export function appendUnique(existing: TmdbListItem[], incoming: TmdbListItem[]) {
  const seen = new Set(existing.map(mediaItemKey));
  return [...existing, ...incoming.filter((item) => !seen.has(mediaItemKey(item)))];
}

export const getTitle = (item: { title?: string; name?: string }) =>
  item.title || item.name || "Untitled";

export const getYear = (item: { release_date?: string; first_air_date?: string }) =>
  (item.release_date || item.first_air_date || "").slice(0, 4) || undefined;

export const typeLabel = (item: TmdbListItem) =>
  isAnimeItem(item) ? "Anime" : getMediaType(item) === "tv" ? "Show" : "Movie";

export const backdropUrl = (path?: string | null, size = "w780") =>
  path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : "/no-image.svg";

type MultiSearchResult = TmdbListItem & { known_for?: TmdbListItem[] };

// TMDB multi-search also returns people; surface the titles they're known for
// instead of the person, so searching an actor still finds their work.
export function flattenSearchResults(results: MultiSearchResult[]): TmdbListItem[] {
  return results.flatMap((result) => {
    if (result.media_type === "person") {
      return (result.known_for || []).filter(
        (item) => item.media_type === "movie" || item.media_type === "tv"
      );
    }
    return result.media_type === "movie" || result.media_type === "tv" ? [result] : [];
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const daysFromToday = (date: string) =>
  Math.round((new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / DAY_MS);

// A short release badge from the dates TMDB list endpoints already include.
export function releaseBadge(item: TmdbListItem): string | undefined {
  const date = item.release_date || item.first_air_date;
  if (!date) return undefined;
  const days = daysFromToday(date);
  if (days > 0) return "Coming soon";
  if (days >= -14) return getMediaType(item) === "tv" ? "New series" : "New release";
  return undefined;
}

export type TmdbVideo = { key?: string; site?: string; type?: string; official?: boolean };
export type TmdbImages = { logos?: { file_path: string; iso_639_1?: string | null }[] };

// Request these with append_to_response=images,videos to get logos and trailers.
export const EXTRAS_PARAMS = { include_image_language: "en,null" };

export function pickTrailerKey(videos: TmdbVideo[] = []): string | null {
  const youtube = videos.filter((video) => video.site === "YouTube" && video.key);
  const trailer =
    youtube.find((video) => video.type === "Trailer" && video.official) ||
    youtube.find((video) => video.type === "Trailer") ||
    youtube.find((video) => video.type === "Teaser");
  return trailer?.key || null;
}

export function pickLogoUrl(images?: TmdbImages): string | null {
  const logos = images?.logos || [];
  const logo = logos.find((entry) => entry.iso_639_1 === "en") || logos[0];
  return logo ? `${TMDB_IMAGE_BASE_URL}/w500${logo.file_path}` : null;
}

export function formatRuntime(minutes?: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export const formatShortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// List endpoints under movie/ or tv/ omit media_type; trending includes people.
export function normalizeListItems(path: string, results: TmdbListItem[] = []): TmdbListItem[] {
  const fixedType = path.match(/^(?:discover\/)?(movie|tv)\b/)?.[1];
  return results
    .filter((item) => item?.id && item.media_type !== "person")
    .map((item) => ({ ...item, media_type: fixedType || getMediaType(item) }));
}

export function toRowItem(
  item: TmdbListItem,
  shape: CardShape,
  options: { badge?: boolean } = {}
): MediaRowItem {
  return {
    id: mediaItemKey(item),
    title: getTitle(item),
    imageUrl: shape === "backdrop" ? backdropUrl(item.backdrop_path) : posterUrl(item.poster_path),
    rating: item.vote_average,
    details: [getYear(item), typeLabel(item)],
    badge: options.badge ? releaseBadge(item) : undefined,
  };
}

export type TypeFilter = "all" | "movie" | "tv" | "anime";

export const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "Shows" },
  { id: "anime", label: "Anime" },
];

export function matchesType(item: TmdbListItem, filter: TypeFilter) {
  if (filter === "all") return true;
  if (filter === "anime") return isAnimeItem(item);
  return getMediaType(item) === filter;
}
