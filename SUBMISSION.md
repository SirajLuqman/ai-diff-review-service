# AI Diff Review Service - Submission Notes

## 1. Service URLs
- **Production Base URL:** `https://ai-diff-review-service-ivqr.onrender.com`
- **GitHub Repository:** `https://github.com/SirajLuqman/ai-diff-review-service`

## 2. Architecture & Provider Design
- **Architecture:** Built with Node.js, Express, and TypeScript. Implements an asynchronous job queue model where `POST /v1/reviews` immediately returns `202 Accepted` with a `jobId`, deferring heavy processing to a non-blocking background worker.
- **Provider Design:** Features a decoupled `LLMProvider` interface with a `MockProvider` fallback to ensure deterministic latency, high reliability, zero API cost overhead, and testability without external network dependencies.
- **Real-Time SSE:** Implemented Server-Sent Events at `/v1/reviews/:id/stream` to stream real-time job state transitions (`queued` -> `running` -> `done`) and incremental finding chunks to subscribers.

## 3. Verification of Cross-Cutting Behaviors
- **Chunking:** Verified via background worker splitting diff payloads into chunked analysis blocks and emitting streaming SSE chunk events (`event: chunk`).
- **Caching:** Verified via SHA-256 hash calculation of input diffs; identical incoming diffs return cached findings and set `cacheHit: true` in usage metadata.
- **Idempotency:** Tested repeated `POST /v1/reviews` requests with identical diff payloads to verify duplicate jobs are handled consistently without re-triggering redundant LLM processing.
- **SSE Replay:** Re-connecting clients to `/v1/reviews/:id/stream` for completed or in-progress jobs immediately receives buffered event state history, ensuring late subscribers do not miss terminal `done` events.

## 4. AI Tool Usage & Rejected Suggestions
- **AI Tools Used:** Utilized Gemini LLM assistance for boilerplate scaffolding, TypeScript interface definitions, Express route error handling, and deployment troubleshooting on Render.
- **Rejected AI Suggestion:** The AI initially suggested adding a heavy external queue (BullMQ + Redis) for job state management. **Reason for Rejection:** An in-memory queue with EventEmitters was selected instead to keep the architecture lightweight, dependency-free, and straightforward for the evaluator to execute and test instantly without setting up external database containers.

## 5. Next Steps with More Time
- **Persistent Storage:** Replace the in-memory job store with Redis/PostgreSQL to maintain state across service restarts or horizontal auto-scaling.
- **Distributed Worker Pool:** Scale out background processing using a dedicated job queue (e.g., BullMQ/RabbitMQ) across multiple instances.
- **Real LLM Integration:** Add configurable OpenAI/Anthropic SDK connectors with automated retry logic and exponential backoff for external API rate limits.