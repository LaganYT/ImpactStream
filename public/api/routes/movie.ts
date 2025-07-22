import { Router } from 'express';
import { getMovieDetails } from '../services/tmdb';

const router = Router();

router.get('/:id', async (req, res) => {
  try {
    const movie = await getMovieDetails(req.params.id);
    res.json(movie);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

export default router; 