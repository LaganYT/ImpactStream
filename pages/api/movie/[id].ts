import type { NextApiRequest, NextApiResponse } from 'next';
import { getMovieDetails } from '../../../lib/tmdb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing or invalid id' });
  try {
    const movie = await getMovieDetails(id);
    res.status(200).json(movie);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
} 