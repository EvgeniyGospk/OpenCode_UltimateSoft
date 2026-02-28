import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { JobRecord } from "../domain/job-types.js";
import type { IJobStore } from "../domain/store-interfaces.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

/**
 * Background worker that polls for pending jobs and executes them
 * by spawning the OpenCode CLI as a child process.
 */
export class SmokeWorker {
  private readonly store: IJobStore;
  private readonly opencodeBin: string;
  private readonly timeoutMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private processing = false;
  private readonly activeProcesses = new Map<string, ChildProcess>();

  constructor(store: IJobStore, options?: { opencodeBin?: string; timeoutMs?: number }) {
    this.store = store;
    this.opencodeBin = options?.opencodeBin ?? process.env.OPENCODE_BIN ?? "opencode";
    this.timeoutMs = options?.timeoutMs ?? (Number(process.env.SMOKE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  start(): void {
    if (this.running) return;
    this.running = true;
    this.pollTimer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    // Kill any active processes
    for (const [jobId, child] of this.activeProcesses) {
      child.kill("SIGTERM");
      this.activeProcesses.delete(jobId);
    }
  }

  /**
   * Kill the child process associated with a job (used by cancel).
   */
  killJob(jobId: string): boolean {
    const child = this.activeProcesses.get(jobId);
    if (child) {
      child.kill("SIGTERM");
      this.activeProcesses.delete(jobId);
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  Polling                                                            */
  /* ------------------------------------------------------------------ */

  private async tick(): Promise<void> {
    if (!this.running || this.processing) return;

    const pending = this.store.getByStatus("pending");
    if (pending.length === 0) return;

    const job = pending[0]!;
    this.processing = true;
    try {
      await this.processJob(job);
    } finally {
      this.processing = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Job execution                                                      */
  /* ------------------------------------------------------------------ */

  async processJob(job: JobRecord): Promise<void> {
    const now = new Date().toISOString();
    this.store.updateStatus(job.id, "running", { startedAt: now });

    const child = spawn(
      this.opencodeBin,
      ["run", "-p", job.prompt, "--agent", job.agentKey],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
        timeout: 0 // we handle our own timeout
      }
    );

    this.activeProcesses.set(job.id, child);

    // Stream stdout
    const rlStdout = createInterface({ input: child.stdout! });
    rlStdout.on("line", (line) => {
      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stdout",
        line
      });
    });

    // Stream stderr
    const rlStderr = createInterface({ input: child.stderr! });
    rlStderr.on("line", (line) => {
      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stderr",
        line
      });
    });

    // Timeout handling
    const timeoutHandle = setTimeout(() => {
      child.kill("SIGTERM");
      this.store.appendLog({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        stream: "stderr",
        line: `[worker] Process killed: timeout after ${this.timeoutMs}ms`
      });
    }, this.timeoutMs);

    return new Promise<void>((resolve) => {
      child.on("close", (code, signal) => {
        clearTimeout(timeoutHandle);
        rlStdout.close();
        rlStderr.close();
        this.activeProcesses.delete(job.id);

        const finishedAt = new Date().toISOString();

        // Check if job was cancelled while running
        const current = this.store.getById(job.id);
        if (current?.status === "cancelled") {
          resolve();
          return;
        }

        if (code === 0) {
          this.store.updateStatus(job.id, "success", { finishedAt, exitCode: 0 });
        } else {
          const errorMsg = signal
            ? `Process terminated by signal ${signal}`
            : `Process exited with code ${code ?? 1}`;
          this.store.updateStatus(job.id, "failed", {
            finishedAt,
            exitCode: code ?? 1,
            error: errorMsg
          });
        }

        resolve();
      });

      child.on("error", (err) => {
        clearTimeout(timeoutHandle);
        rlStdout.close();
        rlStderr.close();
        this.activeProcesses.delete(job.id);

        const finishedAt = new Date().toISOString();

        // Check if cancelled
        const current = this.store.getById(job.id);
        if (current?.status === "cancelled") {
          resolve();
          return;
        }

        this.store.updateStatus(job.id, "failed", {
          finishedAt,
          exitCode: 1,
          error: `Spawn error: ${err.message}`
        });

        resolve();
      });
    });
  }
}
