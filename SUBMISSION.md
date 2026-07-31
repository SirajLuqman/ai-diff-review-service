# AI Diff Review Service - Submission Notes

## 1. Service URLs
- **Production Base URL:** https://ai-diff-review-service-ivqr.onrender.com
- **GitHub Repository:** https://github.com/SirajLuqman/ai-diff-review-service

## 2. Architecture & Design Decisions
- **Runtime & Language:** Node.js with TypeScript (express, tsx) for strict typing, low-latency request handling, and robust async execution.
- **Asynchronous Job Model:** Immediate response with a unique jobId upon POST /v1/reviews. Heavy diff analysis is deferred to an asynchronous background worker.
- **Real-time Event Streaming:** Implemented Server-Sent Events (SSE) at /v1/reviews/:id/stream supporting real-time status transitions (queued -> running -> done) and chunked finding streams.
- **Security & Authentication:** Mandatory Bearer token authentication middleware for protected endpoints (/v1/reviews*).
- **Resiliency & Rate Limiting:** Applied express-rate-limit to mitigate abuse on public routes.

## 3. Trade-offs & Assumptions
- **In-Memory Storage:** Jobs are maintained in-memory for zero external database overhead. In a production multi-node environment, this would be replaced with Redis/PostgreSQL.
- **Provider Fallback:** Integrated mock provider for deterministic latency and offline testability without dependency on paid external LLM APIs.

## 4. AI Tool Usage
- Used LLM assistance for rapid project scaffolding, route handling, TypeScript type safety, and debugging deployment pipeline issues.
