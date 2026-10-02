import axios from "axios";

export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

type TmdbParams = Record<string, string | number | undefined>;

// Client-side TMDB access goes through /api/tmdb so the API key stays on the server.
export async function tmdbFetch<T>(path: string, params: TmdbParams = {}): Promise<T> {
  const { data } = await axios.get<T>(`/api/tmdb/${path.replace(/^\//, "")}`, { params });
  return data;
}
