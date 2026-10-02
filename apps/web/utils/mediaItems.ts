import type { PosterGridItem } from "../components/PosterGrid";
import type { TitleRef } from "../components/TitleModal";
import { getMediaType, isAnimeItem, RoutableMediaItem } from "./mediaRouting";
import { posterUrl } from "./posters";

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
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  return {
    key: mediaItemKey(item),
    title: item.title || item.name || "Untitled",
    posterUrl: posterUrl(item.poster_path),
    label: isAnimeItem(item) ? "ANIME" : getMediaType(item) === "tv" ? "TV" : "MOVIE",
    year: year || undefined,
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
