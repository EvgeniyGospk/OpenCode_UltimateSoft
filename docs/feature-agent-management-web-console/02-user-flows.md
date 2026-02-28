# 02. User Flows

## Purpose
Describe primary user/system flows for the open local console.

## Assumptions
- No login, no role switching.
- Active profile is write target in v1.

## Out of Scope
- Multi-user collaborative sessions.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-001, D-005, D-008, D-010, D-020, D-021, D-024, D-033, D-036, D-037, D-039, D-040, D-041, D-042

## Flow 1: App open
1. User opens console on localhost.
2. UI loads dashboard and active profile summary.

## Flow 2: Edit agent routing
1. User opens `Agents`.
2. Edits mapping values.
3. Clicks save.
4. Backend writes file atomically and creates snapshot.
5. UI reloads current state.

## Flow 3: Run smoke tests
1. User starts smoke job from `Jobs` or `Agents`.
2. Backend enqueues job and returns jobId.
3. Worker executes command set.
4. UI shows logs and status.
5. User can cancel or re-run.

## Flow 4: Backup and restore
1. Writes automatically create restore points.
2. User opens `Backups` and selects snapshot.
3. User confirms restore.
4. Backend applies restore atomically.

## Flow 5: Plugin operations
1. User opens `Settings > Plugins`.
2. Sees installed plugins.
3. Installs from local path or toggles enable/disable.

## Flow 6: Import/export profile
1. User exports profile package.
2. User imports package when needed.
3. Backend applies package and creates restore point.

## Flow 7: Multi-profile read/list
1. User opens profile list.
2. Views non-active profile data in read mode.
3. Writes remain scoped to active profile in v1.
