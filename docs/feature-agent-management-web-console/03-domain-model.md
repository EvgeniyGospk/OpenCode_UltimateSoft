# 03. Domain Model

## Purpose
Define entities, boundaries, and state transitions for the open local console.

## Assumptions
- File profile config is SSOT.
- SQLite stores only operational metadata (jobs/snapshots/audit indexes).

## Out of Scope
- Enterprise-grade policy engines.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-002, D-008, D-010, D-017, D-020, D-024, D-033, D-039, D-040, D-041, D-042

## Bounded contexts
- `ProfileConfig`: read/write profile files.
- `Operations`: jobs lifecycle.
- `Snapshots`: restore points.
- `Plugins`: plugin lifecycle management.

## Entities
- `Profile`: id, name, path, isActive, updatedAt.
- `AgentDefinition`: profileId, agentKey, modelId, params, enabled.
- `ProviderConfig`: profileId, providerKey, settingsRef.
- `Job`: id, type, status, payload, createdAt, startedAt, finishedAt.
- `JobAttempt`: jobId, attemptNo, status, startedAt, endedAt, errorCode.
- `Snapshot`: id, profileId, reason, createdAt, manifestPath.
- `PluginInstallation`: id, pluginName, sourcePath, version, enabled.
- `AuditEvent`: id, action, target, result, requestId, traceId, jobId, createdAt.

## State machines
- `Job`: `queued -> running -> succeeded|failed|canceled`.
- `PluginInstallation`: `installed -> enabled|disabled`.

## Invariants
- Queries have no side effects.
- Successful writes create restore snapshot.
- Snapshot restore is atomic.

## Domain services
- `ConfigMutationService`: atomic file write and snapshot call.
- `SmokeTestOrchestrator`: smoke job composition/execution.
- `PluginLifecycleService`: install/enable/disable orchestration.
- `ImportExportService`: package import/export and apply.
