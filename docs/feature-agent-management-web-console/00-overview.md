# 00. Overview

## Purpose
Define a self-contained blueprint for a fully open local web console to manage OpenCode agent configuration and operations.

## Assumptions
- The app is local-first and open (no in-app auth).
- Profile files remain SSOT.
- Verification-style gates are intentionally excluded.

## Out of Scope
- Cloud multi-tenant deployment.
- Auth/RBAC.
- Verification gates (schema/trust/checksum/rate-limit/preflight/conflict checks).

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-001, D-002, D-003, D-005, D-006, D-007, D-008, D-010, D-011, D-017, D-021, D-024, D-025, D-026, D-027, D-028, D-033, D-036, D-037, D-039, D-040, D-041, D-042

## Vision
- One simple local console for:
  - agent/provider CRUD,
  - smoke jobs,
  - backups/restore,
  - plugin operations,
  - profile import/export.

## Core invariants
- File configuration is SSOT.
- API and worker are not business-truth storage.
- Writes are atomic and recoverable by snapshots.

## Outcome of v1
- Easy local operations with minimal friction.
- Fast implementation path with fewer moving parts.
- Stable base for optional hardening in later versions.
