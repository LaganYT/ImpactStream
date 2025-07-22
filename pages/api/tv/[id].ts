import type { NextApiRequest, NextApiResponse } from 'next';
import { getTvDetails } from '../../../lib/tmdb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing or invalid id' });
  try {
    const tv = await getTvDetails(id);
    res.status(200).json(tv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch TV show details' });
  }
} 