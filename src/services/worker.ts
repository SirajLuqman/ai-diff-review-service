import { Buffer } from 'node:buffer';
import { globalJobStore } from './jobStore.js';
import { runMockReview } from '../providers/mockProvider.js';
import { runLlmReview } from '../providers/llmProvider.js';
import { chunkDiffByFileBoundary } from '../utils/diffParser.js';
import { createCacheKey } from '../utils/hasher.js';
import { Finding } from '../types/index.js';

/**
 * Processes an asynchronous review job.
 */
export async function processJob(jobId: string): Promise<void> {
  const job = globalJobStore.getJob(jobId);
  if (!job) return;

  try {
    globalJobStore.updateJobStatus(jobId, 'running');

    const provider = job.options.provider || 'mock';
    const maxFindings = job.options.maxFindings ?? 100;
    const cacheKey = createCacheKey(job.diff, job.options as Record<string, unknown>);

    // 1. Check Payload Cache
    const cachedFindings = globalJobStore.getCachedFindings(cacheKey);
    if (cachedFindings) {
      const inputBytes = Buffer.byteLength(job.diff, 'utf-8');
      const { count: chunks } = chunkDiffByFileBoundary(job.diff);

      // Replay stream findings if any
      for (const finding of cachedFindings) {
        globalJobStore.addFindingEvent(jobId, finding);
      }

      globalJobStore.completeJob(jobId, cachedFindings, {
        inputBytes,
        chunks,
        cacheHit: true,
      });
      return;
    }

    // 2. Compute Chunks & Input Byte Size
    const inputBytes = Buffer.byteLength(job.diff, 'utf-8');
    const { count: chunks } = chunkDiffByFileBoundary(job.diff);

    let findings: Finding[] = [];

    // 3. Execute Review Provider
    if (provider === 'mock') {
      findings = runMockReview(job.diff, maxFindings);
    } else if (provider === 'llm') {
      findings = await runLlmReview(job.diff, maxFindings);
    }

    // Emit finding events over SSE
    for (const finding of findings) {
      globalJobStore.addFindingEvent(jobId, finding);
    }

    // Save to Cache
    globalJobStore.setCachedFindings(cacheKey, findings);

    // 4. Mark Job Complete
    globalJobStore.completeJob(jobId, findings, {
      inputBytes,
      chunks,
      cacheHit: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal job execution error';
    globalJobStore.failJob(jobId, {
      code: 'internal',
      message,
    });
  }
}