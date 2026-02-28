# 12. Implementation Plan

## Purpose
Provide milestone-based implementation plan for the open local console.

## Assumptions
- Verification-style gates are intentionally excluded.
- The goal is a simple and working local management tool.

## Out of Scope
- Security verification features and access control features.
- Cloud-distributed deployment.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-001, D-002, D-003, D-005, D-006, D-007, D-008, D-010, D-011, D-017, D-021, D-024, D-025, D-026, D-027, D-028, D-033, D-036, D-037, D-039, D-040, D-041, D-042

## Milestone 1: Foundation and contracts
### Tasks
- Scaffold API/UI/module layout with clear SoC boundaries.
- Define OpenAPI v1 base contract and response envelope.
- Set up OpenAPI client/type generation for UI.
- Add requestId/traceId correlation middleware.

### Files/modules impacted
- `apps/console-api/*`
- `apps/console-ui/*`
- `contracts/openapi/v1.yaml`
- `packages/api-client-generated/*`

### Tests
- Unit: envelope/correlation helpers.
- Integration: `/api/v1/health` response and headers.
- Contract: OpenAPI drift check.

### DoD
- Service starts and returns health envelope.
- UI consumes generated client successfully.
- lint/typecheck/contracts/build all green.

### Risks and checks
- Risk: early architecture drift.
- Check: module boundaries enforced in reviews.

### Verification steps
- `npm run lint`
- `npm run typecheck`
- `npm run test:contracts`
- `npm run build`

## Milestone 2: Open app shell and navigation
### Tasks
- Implement app shell and route structure.
- Add pages: Dashboard, Agents, Providers, Jobs, Backups, Settings.
- Add shared layout/components and baseline styling tokens.

### Files/modules impacted
- `apps/console-ui/src/*`
- `apps/console-ui/src/routes/*`
- `apps/console-ui/src/components/*`

### Tests
- Unit: router/layout helpers.
- E2E: page navigation and basic rendering.

### DoD
- All pages are reachable and render baseline state.
- UI build stays green.

### Risks and checks
- Risk: route sprawl.
- Check: route ownership by feature folder.

### Verification steps
- `npm --prefix apps/console-ui run typecheck`
- `npm --prefix apps/console-ui run build`

## Milestone 3: Profile CRUD and atomic write pipeline
### Tasks
- Implement active profile load and save use-cases.
- Implement atomic write (temp + fsync + rename).
- Implement automatic restore-point snapshot on successful save.
- Implement agents/providers CRUD over profile files.

### Files/modules impacted
- `modules/profiles/*`
- `modules/agents/*`
- `modules/providers/*`
- `infra/filesystem/*`
- `modules/backups/*`

### Tests
- Unit: write orchestration and snapshot trigger.
- Integration: atomic write and restore-point creation.
- E2E: edit/save agent mapping.

### DoD
- CRUD works for active profile.
- Every write creates restore point.
- Recovery from snapshot works in integration test.

### Risks and checks
- Risk: partial writes on interruption.
- Check: fault simulation around file replace operations.

### Verification steps
- `npm --prefix apps/console-api run test`
- `npm run build`

## Milestone 4: Jobs engine and smoke execution
### Tasks
- Implement SQLite-backed job queue.
- Implement worker loop for smoke runs.
- Add job status/log retrieval and cancel/retry actions.
- Integrate job controls in UI.

### Files/modules impacted
- `modules/jobs/*`
- `workers/smoke-tests/*`
- `infra/command-runner/*`
- `apps/console-ui/src/features/jobs/*`

### Tests
- Unit: job state transitions.
- Integration: queue persistence and restart recovery.
- E2E: run/cancel/retry smoke job.

### DoD
- Smoke jobs can be launched and tracked from UI.
- Job status persists after restart.
- Logs are visible to user.

### Risks and checks
- Risk: hanging child processes.
- Check: command timeout and cleanup behavior.

### Verification steps
- `npm --prefix apps/console-api run test`
- `npm run build`

## Milestone 5: Plugin lifecycle UI/API
### Tasks
- Implement plugin listing from local plugin path.
- Implement install from path.
- Implement enable/disable operations.
- Add plugin views in Settings.

### Files/modules impacted
- `modules/plugins/*`
- `apps/console-ui/src/features/plugins/*`

### Tests
- Unit: plugin state transitions.
- Integration: install/enable/disable.
- E2E: plugin operation flows from UI.

### DoD
- Plugin lifecycle commands work end-to-end.
- UI reflects plugin states correctly.

### Risks and checks
- Risk: inconsistent plugin state cache.
- Check: always reload state from source after write.

### Verification steps
- `npm --prefix apps/console-api run test`
- `npm run build`

## Milestone 6: Import/export and restore operations
### Tasks
- Implement export package creation.
- Implement import apply flow.
- Integrate import/export UI actions.
- Ensure import applies snapshot safety point.

### Files/modules impacted
- `modules/import-export/*`
- `modules/backups/*`
- `apps/console-ui/src/features/import-export/*`

### Tests
- Unit: package metadata handling.
- Integration: export/import roundtrip.
- E2E: import and subsequent restore.

### DoD
- Import/export works across local profiles.
- Restore after import is available and stable.

### Risks and checks
- Risk: partial import apply.
- Check: apply through temporary staging and atomic replace.

### Verification steps
- `npm --prefix apps/console-api run test`
- `npm run build`

## Milestone 7: Observability and release readiness
### Tasks
- Finalize logs/metrics/audit event flow.
- Add release runbook and operational scripts.
- Stabilize CI and coverage thresholds.

### Files/modules impacted
- `infra/observability/*`
- `modules/audit/*`
- CI scripts/workflows
- docs runbooks

### Tests
- Integration: observability fields in command/query/job flows.
- E2E: golden path suite.
- Coverage: enforce >=90% on new domain/application modules.

### DoD
- All quality gates pass.
- Coverage threshold met.
- Runbook exists for start/build/test/recover.

### Risks and checks
- Risk: hidden regressions after milestone merges.
- Check: full regression run before release tag.

### Verification steps
- `npm run lint`
- `npm run typecheck`
- `npm run test:contracts`
- `npm --prefix apps/console-api run test`
- `npm run build`

## Global rules
- MUST keep project green after each milestone.
- MUST keep business logic out of routes/UI components.
- SHOULD keep modules small and feature-owned.
- NEVER skip snapshot creation on successful write commands.
