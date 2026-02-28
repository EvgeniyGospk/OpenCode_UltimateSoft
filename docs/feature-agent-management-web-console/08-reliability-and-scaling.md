# 08. Reliability and Scaling

## Purpose
Define reliability baseline and scaling path for v1.

## Assumptions
- v1 is local and single-host.
- Future scale path should stay possible without rewrite.

## Out of Scope
- Distributed queue/cluster operation.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-003, D-008, D-010, D-017, D-025, D-039

## Reliability baseline
- Outbound I/O SHOULD have sane timeout values.
- Jobs SHOULD support retry and cancel.
- Process SHOULD shutdown gracefully.

## Queue strategy
- SQLite-backed queue with worker loop.
- Durable job states across restart.

## Scaling path
- Phase 1: single `all` process.
- Phase 2: split `api` and `worker` roles.
- Phase 3: external queue/DB if load requires.

## SLO baseline (v1)
- API uptime target: 99.5% monthly.
- P95 enqueue latency target: < 300ms.
- P95 config save target: < 1.5s.

## Capacity defaults
- Concurrent jobs default: 2 (configurable).
- Queue depth warning threshold: 20.

## Resilience checks
- Restart recovery for queued/running jobs.
- Fault tests for file lock/contention and CLI timeout.
