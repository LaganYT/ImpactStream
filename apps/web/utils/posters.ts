import { TMDB_IMAGE_BASE_URL } from "./tmdbClient";

export function posterUrl(posterPath?: string | null, size = "w500") {
  return posterPath ? `${TMDB_IMAGE_BASE_URL}/${size}${posterPath}` : "/no-image.svg";
}
