import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { globalJobStore } from '../services/jobStore.js';
import { processJob } from '../services/worker.js';
import { hashString } from '../utils/hasher.js';
import { submitRateLimiter } from '../middleware/rateLimit.js';
import { Job, ReviewOptions } from '../types/index.js';

export const reviewsRouter = Router();

// Helper to extract strict string param
function getSingleParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

// POST /v1/reviews
reviewsRouter.post('/', submitRateLimiter, (req: Request, res: Response) => {
  const { diff, options } = req.body || {};

  // Validate diff
  if (typeof diff !== 'string' || diff.trim() === '') {
    res.status(422).json({
      error: {
        code: 'invalid_diff',
        message: 'Diff field is required, non-empty, and must be string unified diff',
      },
    });
    return;
  }

  // Basic unified diff check
  if (!diff.includes('+++') && !diff.includes('@@')) {
    res.status(422).json({
      error: {
        code: 'invalid_diff',
        message: 'Payload is not a valid unified diff',
      },
    });
    return;
  }

  const reviewOptions: ReviewOptions = {
    provider: options?.provider === 'llm' ? 'llm' : 'mock',
    maxFindings: typeof options?.maxFindings === 'number' ? options.maxFindings : 100,
  };

  const rawKey = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

  const currentBodyHash = hashString(JSON.stringify({ diff, options: reviewOptions }));

  // Handle Idempotency
  if (idempotencyKey) {
    const existing = globalJobStore.getIdempotentJob(idempotencyKey);
    if (existing) {
      if (existing.bodyHash === currentBodyHash) {
        // Return existing jobId for matching key + body
        res.status(202).json({
          jobId: existing.jobId,
          status: 'queued',
        });
        return;
      } else {
        // Conflict if key is reused with different body
        res.status(409).json({
          error: {
            code: 'idempotency_conflict',
            message: 'Idempotency key reused with different request payload',
          },
        });
        return;
      }
    }
  }

  // Create new job
  const jobId = uuidv4();
  const job: Job = {
    id: jobId,
    status: 'queued',
    diff,
    options: reviewOptions,
    findings: [],
    usage: { inputBytes: 0, chunks: 0, cacheHit: false },
    createdAt: new Date(),
  };

  globalJobStore.createJob(job);

  if (idempotencyKey) {
    globalJobStore.setIdempotentJob(idempotencyKey, jobId, currentBodyHash);
  }

  // Dispatch background execution asynchronously
  setImmediate(() => {
    processJob(jobId).catch((err) => {
      console.error(`Error processing job ${jobId}:`, err);
    });
  });

  res.status(202).json({
    jobId,
    status: 'queued',
  });
});

// GET /v1/reviews/:jobId
reviewsRouter.get('/:jobId', (req: Request, res: Response) => {
  const jobId = getSingleParam(req.params.jobId);
  const job = globalJobStore.getJob(jobId);

  if (!job) {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: `Job with ID '${jobId}' was not found`,
      },
    });
    return;
  }

  if (job.status === 'done') {
    res.status(200).json({
      jobId: job.id,
      status: job.status,
      findings: job.findings,
      usage: job.usage,
    });
  } else if (job.status === 'failed') {
    res.status(200).json({
      jobId: job.id,
      status: job.status,
      error: job.error,
      usage: job.usage,
    });
  } else {
    res.status(200).json({
      jobId: job.id,
      status: job.status,
    });
  }
});

// GET /v1/reviews/:jobId/stream (SSE)
reviewsRouter.get('/:jobId/stream', (req: Request, res: Response) => {
  const jobId = getSingleParam(req.params.jobId);
  const job = globalJobStore.getJob(jobId);

  if (!job) {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: `Job with ID '${jobId}' was not found`,
      },
    });
    return;
  }

  // SSE Response Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  res.write('\n');

  globalJobStore.subscribeStream(jobId, res);

  req.on('close', () => {
    globalJobStore.unsubscribeStream(jobId, res);
  });
});