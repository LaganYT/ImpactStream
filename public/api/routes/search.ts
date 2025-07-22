import { Router } from 'express';
import { searchTMDB } from '../services/tmdb';

const router = Router();

router.get('/', async (req, res) => {
  const query = req.query.query as string;
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try {
    const results = await searchTMDB(query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search TMDB' });
  }
});

export default router; 