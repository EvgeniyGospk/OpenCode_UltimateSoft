# 01. Requirements

## Purpose
Specify functional and non-functional requirements for the open local console.

## Assumptions
- Decision log is final for v1.
- OpenCode CLI/runtime remains the execution backend for smoke commands.

## Out of Scope
- Security verification gates.
- User identity/permissions model.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-001, D-002, D-003, D-005, D-006, D-007, D-008, D-010, D-011, D-017, D-021, D-024, D-025, D-026, D-027, D-028, D-033, D-036, D-037, D-039, D-040, D-041, D-042

## Functional requirements
- FR-001: Console MUST run on local machine and expose UI + API via one service.
- FR-002: Console MUST support active-profile config read/write.
- FR-003: Console MUST support CRUD for agents and providers.
- FR-004: Console MUST support smoke tests as background jobs with logs and status.
- FR-005: Console MUST support cancel/retry for jobs from UI.
- FR-006: Console MUST create restore snapshot on each successful write.
- FR-007: Console MUST support snapshot restore.
- FR-008: Console MUST support plugin list/install/enable/disable.
- FR-009: Console MUST support profile import/export package flow.
- FR-010: Console MUST support list/read multiple profiles and write active profile in v1.

## Non-functional requirements
- NFR-001: MUST keep SoC layers (UI/Transport/Application/Domain/Infra).
- NFR-002: SHOULD keep module SRP and avoid god services.
- NFR-003: MUST keep file SSOT for profile data.
- NFR-004: MUST use atomic write flow with rollback snapshots.
- NFR-005: MUST keep API contract in OpenAPI and generate client/types from it.
- NFR-006: MUST include requestId/traceId correlation in API logs/responses.
- NFR-007: MUST keep new logic coverage target >=90%.
- NFR-008: MUST keep CI gates: lint, typecheck, contract checks, tests, build.

## MUST / SHOULD / NEVER baseline
- MUST: queries stay side-effect free.
- MUST: contract changes flow through OpenAPI SSOT.
- SHOULD: keep implementation simple before adding complexity.
- NEVER: place business rules in route handlers or React components.

## Success criteria
- Full local operational loop works from UI without shell-only steps.
- Build and checks pass consistently.
- Restore path works after config changes.
