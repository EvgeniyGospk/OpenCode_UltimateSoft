/**
 * Shared type-guard utilities.
 *
 * Single source of truth – every page imports from here instead of
 * maintaining its own copy.
 */

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function countObjectKeys(value: unknown): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return 0;
  }

  return Object.keys(value).length;
}
