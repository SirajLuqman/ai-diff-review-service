import { Response } from 'express';
import { Job, Finding, JobStatus } from '../types/index.js';

interface StreamEvent {
  event: 'status' | 'finding' | 'done';
  data: unknown;
}

export class JobStore {
  private jobs = new Map<string, Job>();
  private cache = new Map<string, Finding[]>(); // cacheKey -> findings
  private idempotencyKeys = new Map<string, { jobId: string; bodyHash: string }>(); // idempotencyKey -> metadata
  private sseClients = new Map<string, Set<Response>>(); // jobId -> active Express SSE responses
  private eventLogs = new Map<string, StreamEvent[]>(); // jobId -> event history for replay

  // Job Creation & Retrieval
  public createJob(job: Job): void {
    this.jobs.set(job.id, job);
    this.eventLogs.set(job.id, []);
    this.addEvent(job.id, 'status', { status: job.status });
  }

  public getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  public updateJobStatus(jobId: string, status: JobStatus): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      this.addEvent(jobId, 'status', { status });
    }
  }

  public completeJob(jobId: string, findings: Finding[], usage: Job['usage']): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'done';
      job.findings = findings;
      job.usage = usage;

      this.addEvent(jobId, 'status', { status: 'done' });
      this.addEvent(jobId, 'done', {
        total: findings.length,
        usage,
      });

      this.closeStream(jobId);
    }
  }

  public failJob(jobId: string, error: { code: string; message: string }): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;

      this.addEvent(jobId, 'status', { status: 'failed', error });
      this.closeStream(jobId);
    }
  }

  // Idempotency Management
  public getIdempotentJob(key: string): { jobId: string; bodyHash: string } | undefined {
    return this.idempotencyKeys.get(key);
  }

  public setIdempotentJob(key: string, jobId: string, bodyHash: string): void {
    this.idempotencyKeys.set(key, { jobId, bodyHash });
  }

  // Cache Management
  public getCachedFindings(cacheKey: string): Finding[] | undefined {
    return this.cache.get(cacheKey);
  }

  public setCachedFindings(cacheKey: string, findings: Finding[]): void {
    this.cache.set(cacheKey, findings);
  }

  // SSE Stream Management & Event Replay
  public addFindingEvent(jobId: string, finding: Finding): void {
    this.addEvent(jobId, 'finding', finding);
  }

  private addEvent(jobId: string, eventName: 'status' | 'finding' | 'done', data: unknown): void {
    const streamEvent: StreamEvent = { event: eventName, data };
    const logs = this.eventLogs.get(jobId) || [];
    logs.push(streamEvent);
    this.eventLogs.set(jobId, logs);

    // Broadcast in real-time to active listeners
    const clients = this.sseClients.get(jobId);
    if (clients) {
      const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of clients) {
        res.write(payload);
      }
    }
  }

  public subscribeStream(jobId: string, res: Response): void {
    if (!this.sseClients.has(jobId)) {
      this.sseClients.set(jobId, new Set());
    }
    this.sseClients.get(jobId)!.add(res);

    // Replay past events
    const logs = this.eventLogs.get(jobId) || [];
    for (const { event, data } of logs) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    const job = this.jobs.get(jobId);
    if (job && (job.status === 'done' || job.status === 'failed')) {
      res.end();
    }
  }

  public unsubscribeStream(jobId: string, res: Response): void {
    const clients = this.sseClients.get(jobId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.sseClients.delete(jobId);
      }
    }
  }

  private closeStream(jobId: string): void {
    const clients = this.sseClients.get(jobId);
    if (clients) {
      for (const res of clients) {
        res.end();
      }
      this.sseClients.delete(jobId);
    }
  }
}

export const globalJobStore = new JobStore();