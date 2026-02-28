import { beforeEach, describe, expect, it } from "vitest";
import { JobService } from "../src/modules/jobs/application/job-service.js";
import type { IJobStore } from "../src/modules/jobs/domain/store-interfaces.js";
import type { JobLogEntry, JobRecord, JobStatus } from "../src/modules/jobs/domain/job-types.js";
import { JobServiceError } from "../src/modules/jobs/domain/errors.js";

/* ------------------------------------------------------------------ */
/*  In-memory mock store                                               */
/* ------------------------------------------------------------------ */

class MockJobStore implements IJobStore {
  private jobs = new Map<string, JobRecord>();
  private logs: JobLogEntry[] = [];
  private logId = 0;

  create(job: JobRecord): void {
    this.jobs.set(job.id, { ...job });
  }

  getById(id: string): JobRecord | undefined {
    const job = this.jobs.get(id);
    return job ? { ...job } : undefined;
  }

  list(): JobRecord[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateStatus(
    id: string,
    status: JobStatus,
    patch?: Partial<Pick<JobRecord, "startedAt" | "finishedAt" | "exitCode" | "error">>
  ): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = status;
    if (patch?.startedAt !== undefined) job.startedAt = patch.startedAt;
    if (patch?.finishedAt !== undefined) job.finishedAt = patch.finishedAt;
    if (patch?.exitCode !== undefined) job.exitCode = patch.exitCode;
    if (patch?.error !== undefined) job.error = patch.error;
  }

  appendLog(entry: Omit<JobLogEntry, "id">): void {
    this.logId++;
    this.logs.push({ ...entry, id: this.logId });
  }

  getLogs(jobId: string): JobLogEntry[] {
    return this.logs.filter((l) => l.jobId === jobId);
  }

  getByStatus(status: JobStatus): JobRecord[] {
    return [...this.jobs.values()].filter((j) => j.status === status);
  }

  deleteOld(_olderThanIso: string): number {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

let mockStore: MockJobStore;
let service: JobService;

beforeEach(() => {
  mockStore = new MockJobStore();
  service = new JobService(mockStore);
});

describe("JobService.createJob", () => {
  it("creates a pending job with a UUID id", () => {
    const job = service.createJob({ type: "smoke", agentKey: "claude", prompt: "hello" });

    expect(job.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(job.status).toBe("pending");
    expect(job.type).toBe("smoke");
    expect(job.agentKey).toBe("claude");
    expect(job.prompt).toBe("hello");
    expect(job.startedAt).toBeNull();
    expect(job.finishedAt).toBeNull();
  });

  it("rejects invalid type", () => {
    expect(() =>
      service.createJob({ type: "invalid" as "smoke", agentKey: "a", prompt: "b" })
    ).toThrow(JobServiceError);
  });

  it("rejects empty agentKey", () => {
    expect(() =>
      service.createJob({ type: "smoke", agentKey: "", prompt: "b" })
    ).toThrow(JobServiceError);
  });

  it("rejects empty prompt", () => {
    expect(() =>
      service.createJob({ type: "smoke", agentKey: "a", prompt: "" })
    ).toThrow(JobServiceError);
  });
});

describe("JobService.listJobs", () => {
  it("returns all jobs sorted by createdAt desc", () => {
    service.createJob({ type: "smoke", agentKey: "a", prompt: "first" });
    service.createJob({ type: "smoke", agentKey: "a", prompt: "second" });

    const jobs = service.listJobs();
    expect(jobs).toHaveLength(2);
    // Most recent first
    expect(jobs[0]!.createdAt >= jobs[1]!.createdAt).toBe(true);
  });
});

describe("JobService.getJob", () => {
  it("returns a job by id", () => {
    const created = service.createJob({ type: "smoke", agentKey: "a", prompt: "p" });
    const found = service.getJob(created.id);
    expect(found.id).toBe(created.id);
  });

  it("throws JOB_NOT_FOUND for missing id", () => {
    expect(() => service.getJob("nonexistent")).toThrow(JobServiceError);
    try {
      service.getJob("nonexistent");
    } catch (err) {
      expect((err as JobServiceError).code).toBe("JOB_NOT_FOUND");
      expect((err as JobServiceError).statusCode).toBe(404);
    }
  });
});

describe("JobService.getJobLogs", () => {
  it("returns logs for existing job", () => {
    const job = service.createJob({ type: "smoke", agentKey: "a", prompt: "p" });
    mockStore.appendLog({
      jobId: job.id,
      timestamp: new Date().toISOString(),
      stream: "stdout",
      line: "output line"
    });

    const logs = service.getJobLogs(job.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.line).toBe("output line");
  });

  it("throws JOB_NOT_FOUND for missing job", () => {
    expect(() => service.getJobLogs("missing")).toThrow(JobServiceError);
  });
});

describe("JobService.cancelJob", () => {
  it("cancels a pending job", () => {
    const job = service.createJob({ type: "smoke", agentKey: "a", prompt: "p" });
    const cancelled = service.cancelJob(job.id);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.finishedAt).not.toBeNull();
  });

  it("rejects cancelling a succeeded job", () => {
    const job = service.createJob({ type: "smoke", agentKey: "a", prompt: "p" });
    mockStore.updateStatus(job.id, "success");

    expect(() => service.cancelJob(job.id)).toThrow(JobServiceError);
    try {
      service.cancelJob(job.id);
    } catch (err) {
      expect((err as JobServiceError).code).toBe("JOB_INVALID_STATE");
      expect((err as JobServiceError).statusCode).toBe(409);
    }
  });
});

describe("JobService.retryJob", () => {
  it("creates a new pending job from a failed one", () => {
    const job = service.createJob({ type: "smoke", agentKey: "a", prompt: "original" });
    mockStore.updateStatus(job.id, "failed");

    const retried = service.retryJob(job.id);
    expect(retried.id).not.toBe(job.id);
    expect(retried.status).toBe("pending");
    expect(retried.prompt).toBe("original");
    expect(retried.agentKey).toBe("a");
  });

  it("creates a new pending job from a cancelled one", () => {
    const job = service.createJob({ type: "smoke", agentKey: "a", prompt: "p" });
    mockStore.updateStatus(job.id, "cancelled");

    const retried = service.retryJob(job.id);
    expect(retried.status).toBe("pending");
  });

  it("rejects retrying a pending job", () => {
    const job = service.createJob({ type: "smoke", agentKey: "a", prompt: "p" });
    expect(() => service.retryJob(job.id)).toThrow(JobServiceError);
  });
});
