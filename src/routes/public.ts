import { Router, Request, Response } from 'express';
import { CONFIG } from '../config.js';

export const publicRouter = Router();

const startTime = Date.now();

// GET /health
publicRouter.get('/health', (req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.status(200).json({
    status: 'ok',
    version: CONFIG.SERVICE_VERSION,
    uptimeSeconds,
  });
});

// GET /spec
publicRouter.get('/spec', (req: Request, res: Response) => {
  res.status(200).json({
    specVersion: CONFIG.SPEC_VERSION,
    providers: ['mock', 'llm'],
    limits: CONFIG.LIMITS,
  });
});