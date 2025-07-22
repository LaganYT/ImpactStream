import type { NextApiRequest, NextApiResponse } from 'next';
import { searchTMDB } from '../../lib/tmdb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query.query as string;
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try {
    const results = await searchTMDB(query);
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search TMDB' });
  }
} 