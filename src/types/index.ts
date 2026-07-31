export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Category = 'security' | 'correctness' | 'performance' | 'style';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Finding {
  id: string;
  ruleId: string;
  path: string;
  line: number;
  severity: Severity;
  category: Category;
  title: string;
  evidence: string;
}

export interface ReviewOptions {
  provider?: 'mock' | 'llm';
  maxFindings?: number;
}

export interface JobUsage {
  inputBytes: number;
  chunks: number;
  cacheHit: boolean;
}

export interface Job {
  id: string;
  status: JobStatus;
  diff: string;
  options: ReviewOptions;
  findings: Finding[];
  usage: JobUsage;
  error?: { code: string; message: string };
  createdAt: Date;
}