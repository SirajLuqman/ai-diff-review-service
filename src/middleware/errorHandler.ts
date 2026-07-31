import { Request, Response, NextFunction } from 'express';

export function globalErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Payload body too large
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'payload_too_large',
        message: 'Payload exceeds maximum limit of 1 MiB (1048576 bytes)',
      },
    });
    return;
  }

  // Syntax error / Invalid JSON
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({
      error: {
        code: 'invalid_json',
        message: 'Malformed JSON payload provided',
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    error: {
      code: 'internal',
      message,
    },
  });
}