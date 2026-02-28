# 11. Rollout and Migrations

## Purpose
Define rollout steps, migration sequencing, and rollback strategy.

## Assumptions
- v1 is local deployment via service manager.
- Backward compatibility should be preserved where practical.

## Out of Scope
- Fleet-wide orchestration.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-019, D-020, D-025, D-033, D-039, D-040, D-041

## Rollout phases
- Phase A: local alpha with test profile.
- Phase B: local beta with real profile.
- Phase C: general availability.

## Migration policy
- SQLite uses forward-only migrations.
- Profile updates use incremental schema handling.

## Import/export compatibility
- Package version must be supported.
- Unsupported versions fail with clear message.

## Rollback strategy
- Restore points for command-level rollback.
- Previous artifact + restore point for release rollback.

## Operational checks
- API health check.
- Job worker readiness.
- Smoke job execution.
- Backup/restore roundtrip.

## Change management
- Breaking changes require ADR and migration note.
