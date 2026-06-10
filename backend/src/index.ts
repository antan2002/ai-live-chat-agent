import 'dotenv/config';
import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { ensureTables, closePool } from './db/index.js';
import chatRouter from './routes/chat.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: '16kb' }));

app.use('/chat', chatRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    await ensureTables();
    console.log('Database tables ready');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start();

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});
