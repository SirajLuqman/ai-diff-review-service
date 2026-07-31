import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  BEARER_TOKEN: process.env.BEARER_TOKEN || 'xsolla-candidate-secret-token-2026',
  SPEC_VERSION: '1.0',
  SERVICE_VERSION: '1.0.0',
  LIMITS: {
    maxPayloadBytes: 1048576, // 1 MiB
    chunkBytes: 65536,        // 64 KiB
    maxConcurrentJobs: 4,
    rateLimitPerMinute: 30,
  },
};