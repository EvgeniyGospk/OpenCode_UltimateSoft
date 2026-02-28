import type { CreateJobInput, JobLogEntry, JobRecord } from "./job-types.js";

/**
 * Application-level interface for managing jobs.
 */
export interface IJobService {
  createJob(input: CreateJobInput): JobRecord;
  listJobs(): JobRecord[];
  getJob(id: string): JobRecord;
  getJobLogs(jobId: string): JobLogEntry[];
  cancelJob(id: string): JobRecord;
  retryJob(id: string): JobRecord;
}
