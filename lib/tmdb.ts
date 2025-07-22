import axios from 'axios';

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export async function searchTMDB(query: string) {
  const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url);
  return data;
}

export async function getMovieDetails(id: string) {
  const url = `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`;
  const { data } = await axios.get(url);
  return data;
}

export async function getTvDetails(id: string) {
  const url = `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`;
  const { data } = await axios.get(url);
  return data;
} 