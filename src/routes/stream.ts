import { Router } from 'express';
import { getStreamingLinks } from '../services/stream';

const router = Router();

router.get('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  try {
    const links = await getStreamingLinks(type, id);
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch streaming links' });
  }
});

export default router; 