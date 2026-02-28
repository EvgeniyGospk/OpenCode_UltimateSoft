# 07. Security and Abuse

## Purpose
Define simplified security posture for the intentionally open local app.

## Assumptions
- App is open and does not enforce verification gates.
- Users are expected to run it in local/trusted environments.

## Out of Scope
- Auth, RBAC, trust verification, rate limits, origin checks.

## Decisions referenced
- [Decision Log](../../FEATURE_DISCOVERY_DECISION_LOG.md)
- IDs: D-036, D-037, D-039, D-040, D-041, D-042

## Security posture
- No in-app access verification.
- No request verification gates.
- No plugin/source verification checks.

## Minimal hygiene rules
- Secrets MUST NOT be committed to repository files.
- Logs SHOULD avoid printing provider secrets/tokens.
- Backup/export artifacts SHOULD be stored carefully by operator.

## Accepted risk
- Open mode increases risk of accidental or unwanted local use.
- Risk is accepted by product decision for simplicity and adoption.

## Operational note
- If stricter security is needed later, it is an additive roadmap item.
