# 04. Architecture

## Purpose
Describe architecture, boundaries, and responsibilities for implementation.

## Assumptions
- One deployable service in v1 (API + UI).
- Future split API/worker should remain possible.

## Out of Scope
- Detailed infra manifests.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-003, D-006, D-007, D-008, D-010, D-011, D-017, D-018, D-021, D-024, D-025, D-028, D-039, D-040, D-041, D-042

## SoC layers
- UI: presentation and interaction only.
- Transport: HTTP routes and DTO mapping.
- Application: command/query orchestration.
- Domain: business behavior.
- Infra: filesystem, SQLite, CLI process runner.

## Dependency rule
- `UI -> Transport -> Application -> Domain`
- Infra is injected into application services.
- Domain does not depend on framework or infra modules.

## Module map
- `modules/agents`
- `modules/providers`
- `modules/profiles`
- `modules/jobs`
- `modules/plugins`
- `modules/backups`
- `modules/import-export`
- `modules/audit`

## Process model
- `all` role: API + worker in one process (v1 default).
- Future: split into `api` and `worker` roles without changing contracts.

## Command path
1. Transport parses request.
2. Application executes use-case.
3. Domain applies rule.
4. Infra writes/reads and returns result.
5. Audit record is emitted.

## Query path
1. Transport parses request.
2. Application loads read model.
3. Domain projection maps response.
4. Response is returned.

## Anti-god rules
- One route file per route group.
- One use-case per command/query.
- Shared utilities remain pure.
