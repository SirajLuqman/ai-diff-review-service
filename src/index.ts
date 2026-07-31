import express from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { publicRouter } from './routes/public.js';
import { reviewsRouter } from './routes/reviews.js';
import { authenticateBearerToken } from './middleware/auth.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

const app = express();

// Configure body parser limits (1 MiB max)
app.use(express.json({ limit: CONFIG.LIMITS.maxPayloadBytes }));
app.use(cors());

// Public endpoints
app.use('/', publicRouter);

// Authenticated endpoints under /v1/*
app.use('/v1/reviews', authenticateBearerToken, reviewsRouter);

// Fallback 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Endpoint or route not found',
    },
  });
});

// Centralized error envelope
app.use(globalErrorHandler);

app.listen(CONFIG.PORT, () => {
  console.log(`AI Diff Review Service listening on port ${CONFIG.PORT}`);
  console.log(`Bearer Token configured: ${CONFIG.BEARER_TOKEN}`);
});