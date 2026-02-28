import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JobStore } from "../src/modules/jobs/infra/job-store.js";
import type { JobRecord } from "../src/modules/jobs/domain/job-types.js";

let store: JobStore;

function makeJob(overrides?: Partial<JobRecord>): JobRecord {
  return {
    id: overrides?.id ?? "job-1",
    type: "smoke",
    status: overrides?.status ?? "pending",
    agentKey: overrides?.agentKey ?? "test-agent",
    prompt: overrides?.prompt ?? "say hello",
    createdAt: overrides?.createdAt ?? "2026-01-01T00:00:00.000Z",
    startedAt: overrides?.startedAt ?? null,
    finishedAt: overrides?.finishedAt ?? null,
    exitCode: overrides?.exitCode ?? null,
    error: overrides?.error ?? null
  };
}

beforeEach(() => {
  store = new JobStore(":memory:");
});

afterEach(() => {
  store.close();
});

describe("JobStore.create + getById", () => {
  it("inserts and retrieves a job record", () => {
    const job = makeJob();
    store.create(job);

    const found = store.getById("job-1");
    expect(found).toEqual(job);
  });

  it("returns undefined for a missing id", () => {
    expect(store.getById("nonexistent")).toBeUndefined();
  });
});

describe("JobStore.list", () => {
  it("returns jobs ordered by createdAt descending", () => {
    store.create(makeJob({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }));
    store.create(makeJob({ id: "b", createdAt: "2026-01-02T00:00:00.000Z" }));
    store.create(makeJob({ id: "c", createdAt: "2026-01-01T12:00:00.000Z" }));

    const list = store.list();
    expect(list.map((j) => j.id)).toEqual(["b", "c", "a"]);
  });

  it("returns empty array when no jobs exist", () => {
    expect(store.list()).toEqual([]);
  });
});

describe("JobStore.updateStatus", () => {
  it("updates status and optional patch fields", () => {
    store.create(makeJob());
    store.updateStatus("job-1", "running", { startedAt: "2026-01-01T00:01:00.000Z" });

    const job = store.getById("job-1")!;
    expect(job.status).toBe("running");
    expect(job.startedAt).toBe("2026-01-01T00:01:00.000Z");
  });

  it("updates status without patch", () => {
    store.create(makeJob());
    store.updateStatus("job-1", "cancelled");

    const job = store.getById("job-1")!;
    expect(job.status).toBe("cancelled");
  });
});

describe("JobStore.appendLog + getLogs", () => {
  it("appends and retrieves log entries in order", () => {
    store.create(makeJob());

    store.appendLog({
      jobId: "job-1",
      timestamp: "2026-01-01T00:00:01.000Z",
      stream: "stdout",
      line: "Hello, world!"
    });
    store.appendLog({
      jobId: "job-1",
      timestamp: "2026-01-01T00:00:02.000Z",
      stream: "stderr",
      line: "Warning: something"
    });

    const logs = store.getLogs("job-1");
    expect(logs).toHaveLength(2);
    expect(logs[0]!.stream).toBe("stdout");
    expect(logs[0]!.line).toBe("Hello, world!");
    expect(logs[1]!.stream).toBe("stderr");
    expect(typeof logs[0]!.id).toBe("number");
  });

  it("returns empty array for job with no logs", () => {
    store.create(makeJob());
    expect(store.getLogs("job-1")).toEqual([]);
  });
});

describe("JobStore.getByStatus", () => {
  it("filters jobs by status", () => {
    store.create(makeJob({ id: "a", status: "pending" }));
    store.create(makeJob({ id: "b", status: "running" }));
    store.create(makeJob({ id: "c", status: "pending" }));

    const pending = store.getByStatus("pending");
    expect(pending).toHaveLength(2);
    expect(pending.map((j) => j.id)).toEqual(["a", "c"]);
  });
});

describe("JobStore.deleteOld", () => {
  it("deletes jobs older than the given timestamp", () => {
    store.create(makeJob({ id: "old", createdAt: "2025-01-01T00:00:00.000Z" }));
    store.create(makeJob({ id: "new", createdAt: "2026-06-01T00:00:00.000Z" }));

    const deleted = store.deleteOld("2026-01-01T00:00:00.000Z");
    expect(deleted).toBe(1);
    expect(store.getById("old")).toBeUndefined();
    expect(store.getById("new")).toBeDefined();
  });
});
