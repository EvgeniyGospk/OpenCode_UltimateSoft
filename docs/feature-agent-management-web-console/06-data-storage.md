# 06. Data Storage

## Purpose
Define storage boundaries, schemas, and migration model.

## Assumptions
- Profile files are SSOT.
- SQLite stores operational state only.

## Out of Scope
- Distributed database topology.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-002, D-008, D-017, D-020, D-033, D-039, D-040, D-041, D-042

## Storage ownership
- File SSOT:
  - `opencode.json`
  - `oh-my-opencode.json`
  - `AGENTS.md`
  - `agent/*.md`
- SQLite metadata:
  - jobs and attempts
  - snapshots index
  - audit events index

## SQLite schema (initial)
- `jobs`
  - `id TEXT PK`
  - `type TEXT NOT NULL`
  - `status TEXT NOT NULL`
  - `payload_json TEXT NOT NULL`
  - `created_at INTEGER NOT NULL`
  - `started_at INTEGER`
  - `finished_at INTEGER`
  - `last_error_code TEXT`
- `job_attempts`
  - `id INTEGER PK AUTOINCREMENT`
  - `job_id TEXT NOT NULL`
  - `attempt_no INTEGER NOT NULL`
  - `status TEXT NOT NULL`
  - `error_code TEXT`
  - `started_at INTEGER NOT NULL`
  - `ended_at INTEGER`
- `snapshots`
  - `id TEXT PK`
  - `profile_id TEXT NOT NULL`
  - `reason TEXT NOT NULL`
  - `manifest_path TEXT NOT NULL`
  - `created_at INTEGER NOT NULL`
- `audit_events`
  - `id TEXT PK`
  - `request_id TEXT NOT NULL`
  - `trace_id TEXT NOT NULL`
  - `job_id TEXT`
  - `action TEXT NOT NULL`
  - `target TEXT NOT NULL`
  - `result TEXT NOT NULL`
  - `payload_redacted_json TEXT NOT NULL`
  - `created_at INTEGER NOT NULL`

## Write model
- Writes use temp file + fsync + atomic rename.
- Successful write creates restore snapshot.

## Migration model
- SQLite migrations are forward-only.
- Profile schema versioning is optional and lightweight in v1.

## Retention
- Audit retention and snapshot retention are configurable.
- Keep latest restore point at minimum.

## Restore
- Restore operation applies selected snapshot atomically.
