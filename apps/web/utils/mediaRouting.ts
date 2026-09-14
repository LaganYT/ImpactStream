export type RoutableMediaItem = {
  id: number;
  media_type?: string;
  first_air_date?: string;
  genre_ids?: number[];
  original_language?: string;
};

export type MediaType = "movie" | "tv";

export function getMediaType(item: RoutableMediaItem): MediaType {
  return item.media_type === "tv" || Boolean(item.first_air_date) ? "tv" : "movie";
}

export function isAnimeItem(item: RoutableMediaItem): boolean {
  return Boolean(
    item.genre_ids?.includes(16) &&
      (item.original_language === "ja" || getMediaType(item) === "tv")
  );
}

export function getDetailRoute(
  item: RoutableMediaItem,
  options?: { play?: boolean }
): { pathname: string; query?: Record<string, string> } {
  const type = getMediaType(item);
  const playQuery: Record<string, string> = options?.play ? { play: "1" } : {};

  if (isAnimeItem(item)) {
    return { pathname: `/anime/${item.id}`, query: { type, ...playQuery } };
  }

  return {
    pathname: `/${type}/${item.id}`,
    query: options?.play ? playQuery : undefined,
  };
}
