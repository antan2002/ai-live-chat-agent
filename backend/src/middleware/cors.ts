import cors from 'cors';

const allowed = process.env.ALLOWED_ORIGINS?.split(',') ?? [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export const corsMiddleware = cors({
  origin: allowed,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
});
