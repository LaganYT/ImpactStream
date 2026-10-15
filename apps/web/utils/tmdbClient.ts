import axios from "axios";
import { useEffect, useState } from "react";

export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

type TmdbParams = Record<string, string | number | undefined>;

// Client-side TMDB access goes through /api/tmdb so the API key stays on the server.
export async function tmdbFetch<T>(path: string, params: TmdbParams = {}): Promise<T> {
  const { data } = await axios.get<T>(`/api/tmdb/${path.replace(/^\//, "")}`, { params });
  return data;
}

// Loads one TMDB response for a component. `data` stays undefined while loading
// and becomes null on failure, so callers can show a skeleton or hide themselves.
// Pass a null path to skip the request.
export function useTmdb<T>(path: string | null, params: TmdbParams = {}) {
  const [data, setData] = useState<T | null | undefined>(undefined);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    setData(undefined);
    tmdbFetch<T>(path, JSON.parse(paramsKey))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, paramsKey]);

  return data;
}
