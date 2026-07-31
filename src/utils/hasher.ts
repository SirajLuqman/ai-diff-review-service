import { createHash } from 'node:crypto';

/**
 * Computes a SHA-256 hash of any string payload.
 */
export function hashString(data: string): string {
  return createHash('sha256').update(data, 'utf-8').digest('hex');
}

/**
 * Creates a deterministic payload hash for caching from diff and review options.
 */
export function createCacheKey(diff: string, options: Record<string, unknown>): string {
  const normalizedPayload = JSON.stringify({ diff, options });
  return hashString(normalizedPayload);
}