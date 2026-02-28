/**
 * Pure business-logic types and helpers for the Jobs domain.
 *
 * Mirrors the API contract types so the page component stays focused
 * on rendering and state orchestration.
 */

// ---------------------------------------------------------------------------
// Status & Type enums
// ---------------------------------------------------------------------------

export type JobStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export type JobType = "smoke";

export type LogStream = "stdout" | "stderr";

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  agentKey: string;
  prompt: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  error?: string;
}

export interface JobLogEntry {
  id: string;
  jobId: string;
  timestamp: string;
  stream: LogStream;
  line: string;
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface CreateJobInput {
  type: JobType;
  agentKey: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// API envelope payloads (match OpenAPI contract)
// ---------------------------------------------------------------------------

export interface JobsListEnvelope {
  requestId: string;
  traceId: string;
  data: { items: JobRecord[] };
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
}

export interface JobDetailEnvelope {
  requestId: string;
  traceId: string;
  data: { job: JobRecord };
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
}

export interface JobLogsEnvelope {
  requestId: string;
  traceId: string;
  data: { items: JobLogEntry[] };
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
}

export interface JobMutationEnvelope {
  requestId: string;
  traceId: string;
  data: { job: JobRecord };
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "var(--color-muted)",
  running: "var(--color-accent)",
  success: "#22c55e",
  failed: "var(--color-danger)",
  cancelled: "var(--color-warning)",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Pending",
  running: "Running",
  success: "Success",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function getStatusColor(status: JobStatus): string {
  return STATUS_COLORS[status] ?? "var(--color-muted)";
}

export function getStatusLabel(status: JobStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Returns a human-readable duration string between two ISO timestamps.
 * If `end` is missing, uses the current time (for running jobs).
 * If `start` is missing, returns "—".
 */
export function formatDuration(start?: string, end?: string): string {
  if (!start) {
    return "\u2014";
  }

  const startMs = Date.parse(start);
  if (Number.isNaN(startMs)) {
    return "\u2014";
  }

  const endMs = end ? Date.parse(end) : Date.now();
  if (Number.isNaN(endMs)) {
    return "\u2014";
  }

  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
