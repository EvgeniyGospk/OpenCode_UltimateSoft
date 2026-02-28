import type { AgentKeyPool, ModelVariantMap } from "@/lib/agents-domain";
import { resolveVariantOptions } from "@/lib/agents-domain";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const KEY_POOL_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "software", label: "Software (source=opencode)" },
  { value: "default", label: "Default (source=codex)" },
] as const satisfies ReadonlyArray<{ value: AgentKeyPool; label: string }>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given a current variant string, a next model ref, and the variant map,
 * return the variant clamped to one of the valid options for that model
 * (or "" if the current variant is not valid).
 */
export function clampVariant(
  currentVariant: string,
  nextModel: string,
  variantMap: ModelVariantMap,
): string {
  const trimmed = currentVariant.trim();
  if (!trimmed) return "";
  const options = resolveVariantOptions(nextModel, variantMap);
  return options.includes(trimmed) ? trimmed : "";
}
