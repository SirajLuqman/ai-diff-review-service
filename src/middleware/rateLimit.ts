import rateLimit from 'express-rate-limit';
import { CONFIG } from '../config.js';

export const submitRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: CONFIG.LIMITS.rateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.setHeader('Retry-After', '60');
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Rate limit exceeded. Maximum 30 review submissions per minute allowed.',
      },
    });
  },
});