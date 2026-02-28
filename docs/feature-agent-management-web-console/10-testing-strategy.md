# 10. Testing Strategy

## Purpose
Define tests, coverage, and CI gates for v1.

## Assumptions
- OpenAPI codegen remains part of pipeline.
- New feature modules will be added incrementally.

## Out of Scope
- Vendor-specific CI workflow syntax.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-011, D-015, D-028, D-039, D-040, D-041, D-042

## Coverage target
- New domain/application logic target: >=90% coverage.

## Test pyramid
- Unit tests:
  - domain rules,
  - file write orchestration,
  - job state transitions.
- Integration tests:
  - SQLite repositories/migrations,
  - atomic write/snapshot,
  - worker run/cancel/retry.
- Contract tests:
  - OpenAPI validity,
  - generated client drift check.
- E2E tests:
  - CRUD path,
  - smoke job path,
  - backup restore,
  - plugin operations,
  - import/export path.

## Non-functional tests
- Restart recovery.
- CLI timeout handling.
- Build and bundle checks.

## CI gates
- lint
- typecheck
- test:contracts
- unit/integration/e2e tests
- build

## Release gate
- All checks green.
- Smoke flow stable across repeated runs.
