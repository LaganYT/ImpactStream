import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import movieRoutes from './routes/movie';
import tvRoutes from './routes/tv';
import searchRoutes from './routes/search';
import streamRoutes from './routes/stream';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/movie', movieRoutes);
app.use('/api/tv', tvRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stream', streamRoutes);

app.get('/', (_req, res) => {
  res.send('ImpactStream Backend API');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 