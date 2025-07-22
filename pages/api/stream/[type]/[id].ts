import type { NextApiRequest, NextApiResponse } from 'next';
import { getStreamingLinks } from '../../../../lib/stream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type, id } = req.query;
  if (!type || !id || typeof type !== 'string' || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid type or id' });
  }
  try {
    const links = await getStreamingLinks(type, id);
    res.status(200).json(links);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch streaming links' });
  }
} 