# 05. Interfaces and Contracts

## Purpose
Define API contracts and internal event contracts for v1.

## Assumptions
- REST + OpenAPI is contract SSOT.
- Generated client/types are used by UI.

## Out of Scope
- Full OpenAPI document listing.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-011, D-024, D-028, D-033, D-039, D-040, D-041, D-042

## API principles
- Response envelope includes `requestId`, `traceId`, `data`, `error`.
- Stable error codes/messages.
- `/api/v1` version prefix.
- CQS separation between query and command routes.

## Standard response envelope
```json
{
  "requestId": "req_...",
  "traceId": "trace_...",
  "data": {},
  "error": null
}
```

## Core endpoint groups
- Health
  - `GET /api/v1/health`
- Profiles
  - `GET /api/v1/profiles`
  - `GET /api/v1/profiles/{id}`
  - `GET /api/v1/profiles/active`
  - `POST /api/v1/profiles/active`
- Agents
  - `GET /api/v1/agents`
  - `POST /api/v1/agents`
  - `PUT /api/v1/agents/{agentKey}`
  - `DELETE /api/v1/agents/{agentKey}`
- Providers
  - `GET /api/v1/providers`
  - `PUT /api/v1/providers/{providerKey}`
- Jobs
  - `POST /api/v1/jobs/smoke-tests`
  - `GET /api/v1/jobs/{jobId}`
  - `POST /api/v1/jobs/{jobId}/cancel`
  - `POST /api/v1/jobs/{jobId}/retry`
- Backups
  - `GET /api/v1/backups`
  - `POST /api/v1/backups/restore/{snapshotId}`
- Plugins
  - `GET /api/v1/plugins`
  - `POST /api/v1/plugins/install`
  - `POST /api/v1/plugins/{id}/enable`
  - `POST /api/v1/plugins/{id}/disable`
- Import/Export
  - `POST /api/v1/profiles/export`
  - `POST /api/v1/profiles/import`

## Internal events
- `ProfileConfigUpdated`
- `ProfileSnapshotCreated`
- `ProfileRestored`
- `SmokeTestJobQueued|Started|Succeeded|Failed|Canceled`
- `PluginInstalled|Enabled|Disabled`
- `ProfileImported|Exported`

## Codegen contract
- OpenAPI is SSOT.
- Codegen runs in CI.
- UI imports generated types/client only.
