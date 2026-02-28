# Feature Discovery Decision Log

## Meta
- Feature: Web console for creating, configuring, and managing OpenCode agents on this machine.
- Stage: Discovery complete.
- Source of truth: This file is the SSOT for accepted feature decisions.
- Started: 2026-02-26
- Change note (2026-02-26): app-level auth/RBAC removed.
- Change note (2026-02-26): all verification-style gates removed by product decision (fully open local app).

## Current Project Baseline (Observed)
- Repository type: OpenCode profile/config package.
- Existing SSOT config files: `opencode.json`, `oh-my-opencode.json`, `AGENTS.md`, `agent/*.md`.
- Local plugin path base: `local-plugins/local-plugins/*`.

## Decision Entries
| ID | Decision | Status | Date |
|---|---|---|---|
| D-001 | Console runs locally (`localhost`) as default mode. | Decided | 2026-02-26 |
| D-002 | Profile files remain SSOT (`opencode.json`, `oh-my-opencode.json`, `AGENTS.md`). | Decided | 2026-02-26 |
| D-003 | Single service architecture (API + UI) for v1. | Decided | 2026-02-26 |
| D-005 | v1 scope includes practical CRUD + smoke jobs + backups/import-export. | Decided | 2026-02-26 |
| D-006 | UI stack: React + TypeScript + Vite. | Decided | 2026-02-26 |
| D-007 | API stack: Fastify + TypeScript. | Decided | 2026-02-26 |
| D-008 | File writes are atomic with restore snapshots. | Decided | 2026-02-26 |
| D-010 | Long-running actions run as background jobs. | Decided | 2026-02-26 |
| D-011 | API contract: REST + OpenAPI (`/api/v1`). | Decided | 2026-02-26 |
| D-017 | Local metadata/jobs storage: SQLite (WAL). | Decided | 2026-02-26 |
| D-021 | IA: Dashboard / Agents / Providers / Jobs / Backups / Settings. | Decided | 2026-02-26 |
| D-024 | Plugin UI supports list/install/enable/disable. | Decided | 2026-02-26 |
| D-025 | Run mode: production build + local service manager. | Decided | 2026-02-26 |
| D-026 | Styling: Tailwind + CSS tokens. | Decided | 2026-02-26 |
| D-027 | Component base: Radix/shadcn with custom wrappers. | Decided | 2026-02-26 |
| D-028 | API client/types generated from OpenAPI. | Decided | 2026-02-26 |
| D-033 | Multi-profile: list/read many, write active profile in v1. | Decided | 2026-02-26 |
| D-036 | No in-app authentication (open local app). | Decided | 2026-02-26 |
| D-037 | No app-level RBAC/viewer/operator split. | Decided | 2026-02-26 |
| D-039 | Remove verification-style gates from v1 scope. | Decided | 2026-02-26 |
| D-040 | No schema/cross-file validation and no conflict-check gate on save. | Decided | 2026-02-26 |
| D-041 | No plugin trust/checksum/signature checks and no import preflight checksum checks. | Decided | 2026-02-26 |
| D-042 | No rate-limit/origin/perimeter verification gates in v1. | Decided | 2026-02-26 |

## Superseded Decisions
- D-009 (validation contract)
- D-012 (session auth)
- D-013 (conflict detection)
- D-022 (RBAC)
- D-023 (idempotency key policy)
- D-029 (strict security retention policy as requirement gate)
- D-032 (session hardening)
- D-034 (checksum-heavy import/export verification)
- D-035 (plugin trust verification)
- D-038 (hardening-first policy)

## Open Risks / Unknowns
- Product risk accepted: open local app without verification gates can increase accidental misuse risk.
- No blocking architecture unknowns remain.
