export type JobStatus = "pending" | "running" | "success" | "failed" | "cancelled";
export type JobType = "smoke";

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  agentKey: string;
  prompt: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  error: string | null;
}

export interface JobLogEntry {
  id: number;
  jobId: string;
  timestamp: string;
  stream: "stdout" | "stderr";
  line: string;
}

export interface CreateJobInput {
  type: JobType;
  agentKey: string;
  prompt: string;
}
