import { randomUUID } from "node:crypto";
import type { CreateJobInput, JobLogEntry, JobRecord } from "../domain/job-types.js";
import type { IJobStore } from "../domain/store-interfaces.js";
import type { IJobService } from "../domain/service-interfaces.js";
import { JobServiceError } from "../domain/errors.js";

const VALID_JOB_TYPES = new Set(["smoke"]);

/**
 * Application service that orchestrates job lifecycle operations.
 */
export class JobService implements IJobService {
  constructor(private readonly store: IJobStore) {}

  createJob(input: CreateJobInput): JobRecord {
    if (!input.type || !VALID_JOB_TYPES.has(input.type)) {
      throw new JobServiceError("INVALID_BODY", "Field 'type' must be one of: smoke.", 400);
    }
    if (!input.agentKey || typeof input.agentKey !== "string") {
      throw new JobServiceError("INVALID_BODY", "Field 'agentKey' must be a non-empty string.", 400);
    }
    if (!input.prompt || typeof input.prompt !== "string") {
      throw new JobServiceError("INVALID_BODY", "Field 'prompt' must be a non-empty string.", 400);
    }

    const job: JobRecord = {
      id: randomUUID(),
      type: input.type,
      status: "pending",
      agentKey: input.agentKey,
      prompt: input.prompt,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      error: null
    };

    this.store.create(job);
    return job;
  }

  listJobs(): JobRecord[] {
    return this.store.list();
  }

  getJob(id: string): JobRecord {
    const job = this.store.getById(id);
    if (!job) {
      throw new JobServiceError("JOB_NOT_FOUND", `Job '${id}' not found.`, 404);
    }
    return job;
  }

  getJobLogs(jobId: string): JobLogEntry[] {
    // Verify job exists first
    this.getJob(jobId);
    return this.store.getLogs(jobId);
  }

  cancelJob(id: string): JobRecord {
    const job = this.getJob(id);
    if (job.status !== "pending" && job.status !== "running") {
      throw new JobServiceError(
        "JOB_INVALID_STATE",
        `Cannot cancel job in '${job.status}' state. Only pending or running jobs can be cancelled.`,
        409
      );
    }

    this.store.updateStatus(id, "cancelled", {
      finishedAt: new Date().toISOString()
    });

    return this.getJob(id);
  }

  retryJob(id: string): JobRecord {
    const job = this.getJob(id);
    if (job.status !== "failed" && job.status !== "cancelled") {
      throw new JobServiceError(
        "JOB_INVALID_STATE",
        `Cannot retry job in '${job.status}' state. Only failed or cancelled jobs can be retried.`,
        409
      );
    }

    return this.createJob({
      type: job.type,
      agentKey: job.agentKey,
      prompt: job.prompt
    });
  }
}
