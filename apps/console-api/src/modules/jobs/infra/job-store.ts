import Database from "better-sqlite3";
import type { JobLogEntry, JobRecord, JobStatus } from "../domain/job-types.js";
import type { IJobStore } from "../domain/store-interfaces.js";

/**
 * SQLite-backed implementation of IJobStore.
 *
 * Creates the schema on construction (CREATE TABLE IF NOT EXISTS)
 * and uses WAL journal mode for better concurrent read performance.
 */
export class JobStore implements IJobStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  /* ------------------------------------------------------------------ */
  /*  Schema                                                             */
  /* ------------------------------------------------------------------ */

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        status      TEXT NOT NULL,
        agent_key   TEXT NOT NULL,
        prompt      TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        started_at  TEXT,
        finished_at TEXT,
        exit_code   INTEGER,
        error       TEXT
      );

      CREATE TABLE IF NOT EXISTS job_logs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id    TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        stream    TEXT NOT NULL,
        line      TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
    `);
  }

  /* ------------------------------------------------------------------ */
  /*  IJobStore                                                          */
  /* ------------------------------------------------------------------ */

  create(job: JobRecord): void {
    this.db.prepare(`
      INSERT INTO jobs (id, type, status, agent_key, prompt, created_at, started_at, finished_at, exit_code, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.type,
      job.status,
      job.agentKey,
      job.prompt,
      job.createdAt,
      job.startedAt,
      job.finishedAt,
      job.exitCode,
      job.error
    );
  }

  getById(id: string): JobRecord | undefined {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as RawJobRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  list(): JobRecord[] {
    const rows = this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all() as RawJobRow[];
    return rows.map(mapRow);
  }

  updateStatus(
    id: string,
    status: JobStatus,
    patch?: Partial<Pick<JobRecord, "startedAt" | "finishedAt" | "exitCode" | "error">>
  ): void {
    this.db.prepare(`
      UPDATE jobs
         SET status      = ?,
             started_at  = COALESCE(?, started_at),
             finished_at = COALESCE(?, finished_at),
             exit_code   = COALESCE(?, exit_code),
             error       = COALESCE(?, error)
       WHERE id = ?
    `).run(
      status,
      patch?.startedAt ?? null,
      patch?.finishedAt ?? null,
      patch?.exitCode ?? null,
      patch?.error ?? null,
      id
    );
  }

  appendLog(entry: Omit<JobLogEntry, "id">): void {
    this.db.prepare(`
      INSERT INTO job_logs (job_id, timestamp, stream, line)
      VALUES (?, ?, ?, ?)
    `).run(entry.jobId, entry.timestamp, entry.stream, entry.line);
  }

  getLogs(jobId: string): JobLogEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM job_logs WHERE job_id = ? ORDER BY id ASC")
      .all(jobId) as RawLogRow[];
    return rows.map(mapLogRow);
  }

  getByStatus(status: JobStatus): JobRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM jobs WHERE status = ? ORDER BY created_at ASC")
      .all(status) as RawJobRow[];
    return rows.map(mapRow);
  }

  deleteOld(olderThanIso: string): number {
    const info = this.db
      .prepare("DELETE FROM jobs WHERE created_at < ?")
      .run(olderThanIso);
    return info.changes;
  }

  /** Close the underlying database connection. */
  close(): void {
    this.db.close();
  }
}

/* ------------------------------------------------------------------ */
/*  Row-to-domain mappers                                              */
/* ------------------------------------------------------------------ */

interface RawJobRow {
  id: string;
  type: string;
  status: string;
  agent_key: string;
  prompt: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  error: string | null;
}

interface RawLogRow {
  id: number;
  job_id: string;
  timestamp: string;
  stream: string;
  line: string;
}

function mapRow(row: RawJobRow): JobRecord {
  return {
    id: row.id,
    type: row.type as JobRecord["type"],
    status: row.status as JobRecord["status"],
    agentKey: row.agent_key,
    prompt: row.prompt,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    exitCode: row.exit_code,
    error: row.error
  };
}

function mapLogRow(row: RawLogRow): JobLogEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    timestamp: row.timestamp,
    stream: row.stream as JobLogEntry["stream"],
    line: row.line
  };
}
