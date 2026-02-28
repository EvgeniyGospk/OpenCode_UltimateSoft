import type { JobLogEntry, JobRecord, JobStatus } from "./job-types.js";

/**
 * Persistence interface for job records and their log output.
 */
export interface IJobStore {
  create(job: JobRecord): void;
  getById(id: string): JobRecord | undefined;
  list(): JobRecord[];
  updateStatus(
    id: string,
    status: JobStatus,
    patch?: Partial<Pick<JobRecord, "startedAt" | "finishedAt" | "exitCode" | "error">>
  ): void;
  appendLog(entry: Omit<JobLogEntry, "id">): void;
  getLogs(jobId: string): JobLogEntry[];
  getByStatus(status: JobStatus): JobRecord[];
  deleteOld(olderThanIso: string): number;
}
