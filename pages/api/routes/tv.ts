import { Router } from 'express';
import { getTvDetails } from '../services/tmdb';

const router = Router();

router.get('/:id', async (req, res) => {
  try {
    const tv = await getTvDetails(req.params.id);
    res.json(tv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch TV show details' });
  }
});

export default router; 