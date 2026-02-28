# 09. Observability

## Purpose
Define logs, metrics, traces, and diagnostics for operations.

## Assumptions
- Correlation fields are present in API and job execution paths.

## Out of Scope
- Monitoring vendor selection.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-014, D-028, D-039

## Correlation
- Include `requestId` and `traceId` in responses/logs.
- Include `jobId` for async jobs.

## Logs
- Structured logs in JSON format.
- Levels: debug/info/warn/error.

## Metrics
- HTTP request count/error/latency by route.
- Jobs queued/running/succeeded/failed/canceled.
- Queue depth and queue age.
- Process memory/event-loop lag.

## Traces
- Trace key flows:
  - config save,
  - snapshot restore,
  - smoke job execution,
  - plugin install/enable/disable.

## Audit
- Record write operations with correlation ids.
- Keep redacted payload representation where possible.

## Dashboards
- API health.
- Job pipeline.
- Config mutation outcomes.
