export type TmdbType = "movie" | "tv";
export type MediaCategory = "movie" | "tv" | "anime";

type TmdbGenre = {
  id: number;
  name: string;
};

type TmdbMediaPayload = {
  id: number;
  media_type?: string;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  vote_average?: number;
  popularity?: number;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
};

export type MediaSummary = {
  id: string;
  tmdbType: TmdbType;
  category: MediaCategory;
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  releaseYear: string;
  rating: number | null;
  popularity: number | null;
  originalLanguage: string | null;
};

export type MediaDetail = MediaSummary & {
  genres: string[];
  runtimeLabel: string;
  seasonsLabel?: string;
  status?: string;
  availabilityNote: string;
  playbackAvailable: boolean;
  downloadAvailable: boolean;
  authorizedPlaybackUrl: string | null;
  authorizedDownloadUrl: string | null;
};

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";

export function getTmdbApiKey(): string {
  const key = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

  if (!key) {
    throw new Error(
      "TMDB API key is missing. Set TMDB_API_KEY or NEXT_PUBLIC_TMDB_API_KEY."
    );
  }

  return key;
}

export async function tmdbGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", getTmdbApiKey());

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export function toMediaSummary(
  item: TmdbMediaPayload,
  forcedType?: TmdbType
): MediaSummary | null {
  if (!item?.id) {
    return null;
  }

  const tmdbType = resolveTmdbType(item, forcedType);
  const category = isAnime(item, tmdbType) ? "anime" : tmdbType;
  const releaseDate = item.release_date || item.first_air_date || null;

  return {
    id: String(item.id),
    tmdbType,
    category,
    title: item.title || item.name || "Untitled",
    overview: item.overview || "No overview is available for this title yet.",
    posterUrl: item.poster_path ? `${TMDB_POSTER_BASE_URL}${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `${TMDB_BACKDROP_BASE_URL}${item.backdrop_path}` : null,
    releaseDate,
    releaseYear: releaseDate ? releaseDate.slice(0, 4) : "",
    rating: typeof item.vote_average === "number" ? item.vote_average : null,
    popularity: typeof item.popularity === "number" ? item.popularity : null,
    originalLanguage: item.original_language || null,
  };
}

export function toMediaDetail(
  item: TmdbMediaPayload,
  forcedType?: TmdbType,
  forcedCategory?: MediaCategory
): MediaDetail | null {
  const summary = toMediaSummary(item, forcedType);
  if (!summary) {
    return null;
  }

  const tmdbType = summary.tmdbType;
  const runtimeLabel =
    tmdbType === "movie"
      ? item.runtime
        ? `${item.runtime} min`
        : "Runtime unavailable"
      : item.episode_run_time?.[0]
        ? `${item.episode_run_time[0]} min episodes`
        : item.number_of_episodes
          ? `${item.number_of_episodes} episodes`
          : "Episode runtime unavailable";

  return {
    ...summary,
    category: forcedCategory || summary.category,
    genres: (item.genres || []).map((genre) => genre.name),
    runtimeLabel,
    seasonsLabel:
      tmdbType === "tv" && item.number_of_seasons
        ? `${item.number_of_seasons} seasons`
        : undefined,
    status: item.status,
    availabilityNote:
      "This API currently provides live metadata only. Add authorized source URLs on the server before enabling playback or downloads in the Flutter client.",
    playbackAvailable: false,
    downloadAvailable: false,
    authorizedPlaybackUrl: null,
    authorizedDownloadUrl: null,
  };
}

function resolveTmdbType(item: TmdbMediaPayload, forcedType?: TmdbType): TmdbType {
  if (forcedType) {
    return forcedType;
  }

  return item.media_type === "tv" || Boolean(item.first_air_date) ? "tv" : "movie";
}

function isAnime(item: TmdbMediaPayload, tmdbType: TmdbType): boolean {
  const genreIds = item.genre_ids || (item.genres || []).map((genre) => genre.id);
  return Boolean(
    genreIds.includes(16) &&
      (item.original_language === "ja" || tmdbType === "tv")
  );
}
