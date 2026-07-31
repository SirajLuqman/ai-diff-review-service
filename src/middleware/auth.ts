import { Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config.js';

export function authenticateBearerToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const rawAuth = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!rawAuth || !rawAuth.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Missing or malformed Authorization header with Bearer token',
      },
    });
    return;
  }

  const token = rawAuth.substring(7).trim();
  if (token !== CONFIG.BEARER_TOKEN) {
    res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid bearer token',
      },
    });
    return;
  }

  next();
}