# 15. UI Design Notes

## Purpose
Capture UI direction for a simple open local operations console.

## Assumptions
- React + Vite + Tailwind + Radix/shadcn.
- Multi-page IA is fixed.

## Out of Scope
- Complex animation system.
- Advanced theming variants.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-021, D-026, D-027, D-039

## IA
- Top nav: Dashboard, Agents, Providers, Jobs, Backups, Settings.
- Settings sections: Plugins, Import/Export, Observability.

## UI rules
- Clear page-level actions for save/run/restore/import/export.
- Destructive actions show explicit confirmation modal.
- Async actions show progress state and cancel when available.
- Error surfaces must be actionable and concise.

## Design system
- Tailwind tokens for spacing, color roles, typography, radius.
- Shared component wrappers over Radix/shadcn primitives.

## Performance notes
- Lazy-load heavier routes.
- Keep data fetching in feature hooks.
