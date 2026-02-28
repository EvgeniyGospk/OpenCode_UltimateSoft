/**
 * Pure business-logic functions for the Agents domain.
 *
 * Extracted from agents-page.tsx so that the page component is focused
 * exclusively on rendering and state orchestration.
 *
 * Every function in this module is pure (no React state, no side-effects).
 */

import type {
  AgentsEnvelope,
  ProvidersEnvelope
} from "@opencode-console/api-client-generated";
import { isJsonObject } from "@/lib/guards";

// ---------------------------------------------------------------------------
// Re-export shared types so the page can import them from one place.
// ---------------------------------------------------------------------------

export type AgentItem = AgentsEnvelope["data"]["items"][number];
export type ProviderItem = ProvidersEnvelope["data"]["items"][number];
export type AgentKeyPool = AgentItem["keyPool"];

export type SortMode = "created-desc" | "created-asc" | "key-asc" | "key-desc";

export interface ParsedModelRef {
  prefix: string;
  modelId: string;
}

export interface ModelCatalog {
  prefixes: string[];
  modelIdsByPrefix: Record<string, string[]>;
}

export type ModelVariantMap = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FALLBACK_MODEL_IDS = [
  "anthropic/claude-haiku-4-5",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-opus-4-6"
] as const;

export const VARIANT_ORDER = [
  "low",
  "medium",
  "high",
  "max",
  "xhigh",
  "extra-high",
  "extra_high"
] as const;

// ---------------------------------------------------------------------------
// Definition readers
// ---------------------------------------------------------------------------

export function readModel(definition: AgentItem["definition"]): string {
  const value = definition.model;
  return typeof value === "string" ? value : "";
}

export function readVariant(definition: AgentItem["definition"]): string {
  const value = definition.variant;
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// Model reference helpers
// ---------------------------------------------------------------------------

export function pushModelRef(pool: Set<string>, value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return;
  }
  pool.add(normalized);
}

export function parseModelRef(value: string): ParsedModelRef {
  const normalized = value.trim();
  if (!normalized) {
    return { prefix: "", modelId: "" };
  }

  const slashIndex = normalized.indexOf("/");
  if (slashIndex < 0) {
    return { prefix: "", modelId: normalized };
  }

  return {
    prefix: normalized.slice(0, slashIndex),
    modelId: normalized.slice(slashIndex + 1)
  };
}

export function composeModelRef(prefix: string, modelId: string): string {
  const normalizedPrefix = prefix.trim();
  const normalizedModelId = modelId.trim();

  if (!normalizedModelId) {
    return "";
  }

  return normalizedPrefix
    ? `${normalizedPrefix}/${normalizedModelId}`
    : normalizedModelId;
}

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------

export function buildModelCatalog(pool: string[]): ModelCatalog {
  const byPrefix = new Map<string, Set<string>>();

  for (const modelRef of pool) {
    const parsed = parseModelRef(modelRef);
    if (!parsed.modelId) {
      continue;
    }

    const existing = byPrefix.get(parsed.prefix) ?? new Set<string>();
    existing.add(parsed.modelId);
    byPrefix.set(parsed.prefix, existing);
  }

  const prefixes = [...byPrefix.keys()].sort((left, right) =>
    left.localeCompare(right)
  );
  const modelIdsByPrefix: Record<string, string[]> = {};

  for (const prefix of prefixes) {
    modelIdsByPrefix[prefix] = [...(byPrefix.get(prefix) ?? [])].sort(
      (left, right) => left.localeCompare(right)
    );
  }

  return { prefixes, modelIdsByPrefix };
}

// ---------------------------------------------------------------------------
// Variant helpers
// ---------------------------------------------------------------------------

export function extractModelVariantMap(items: ProviderItem[]): ModelVariantMap {
  const map: ModelVariantMap = {};

  for (const provider of items) {
    const providerKey = provider.key.trim();
    if (!providerKey || !isJsonObject(provider.definition)) {
      continue;
    }

    const models = provider.definition.models;
    if (!isJsonObject(models)) {
      continue;
    }

    for (const [modelKey, modelDefinition] of Object.entries(models)) {
      if (!isJsonObject(modelDefinition)) {
        continue;
      }

      const variants = modelDefinition.variants;
      if (!isJsonObject(variants)) {
        continue;
      }

      const modelRef = `${providerKey}/${modelKey}`.trim();
      if (!modelRef) {
        continue;
      }

      const variantKeys = Object.entries(variants)
        .filter(([, variantDefinition]) => {
          if (!isJsonObject(variantDefinition)) {
            return true;
          }
          return variantDefinition.disabled !== true;
        })
        .map(([variantKey]) => variantKey.trim())
        .filter((variantKey) => variantKey.length > 0);

      if (variantKeys.length === 0) {
        continue;
      }

      map[modelRef] = [...new Set(variantKeys)].sort((left, right) =>
        left.localeCompare(right)
      );
    }
  }

  return map;
}

export function getVariantRank(value: string): number {
  const normalized = value.trim().toLowerCase();
  const index = VARIANT_ORDER.indexOf(
    normalized as (typeof VARIANT_ORDER)[number]
  );
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function formatVariantLabel(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "Default";
  }

  const lower = normalized.toLowerCase();
  if (lower === "xhigh") {
    return "Xhigh";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function inferModelVariants(modelRef: string): string[] {
  const parsed = parseModelRef(modelRef);
  const modelLower = parsed.modelId.toLowerCase();
  const prefixLower = parsed.prefix.toLowerCase();

  if (prefixLower === "anthropic" && modelLower.startsWith("claude-")) {
    return ["low", "medium", "high", "max"];
  }

  if (
    prefixLower === "openai" &&
    (modelLower.includes("codex") || modelLower.startsWith("gpt-5"))
  ) {
    return ["low", "medium", "high", "max", "xhigh"];
  }

  return [];
}

export function resolveVariantOptions(
  modelRef: string,
  modelVariantMap: ModelVariantMap
): string[] {
  const explicitVariants = modelVariantMap[modelRef] ?? [];
  const inferredVariants = inferModelVariants(modelRef);
  const merged = new Set<string>([...explicitVariants, ...inferredVariants]);

  return [...merged].sort((left, right) => {
    const rankDelta = getVariantRank(left) - getVariantRank(right);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return left.localeCompare(right);
  });
}

export function toVariantOptions(
  modelRef: string,
  currentVariant: string,
  modelVariantMap: ModelVariantMap
): string[] {
  const options = new Set<string>(
    resolveVariantOptions(modelRef, modelVariantMap)
  );
  const normalizedCurrent = currentVariant.trim();

  if (normalizedCurrent) {
    options.add(normalizedCurrent);
  }

  return [...options].sort((left, right) => {
    const rankDelta = getVariantRank(left) - getVariantRank(right);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return left.localeCompare(right);
  });
}

// ---------------------------------------------------------------------------
// Model pool extraction
// ---------------------------------------------------------------------------

export function extractAvailableModels(
  items: ProviderItem[],
  agents: AgentItem[]
): string[] {
  const modelPool = new Set<string>();

  for (const provider of items) {
    const providerKey = provider.key.trim();
    if (!providerKey) {
      continue;
    }

    if (!isJsonObject(provider.definition)) {
      continue;
    }

    const models = provider.definition.models;
    if (!isJsonObject(models)) {
      continue;
    }

    for (const modelKey of Object.keys(models)) {
      pushModelRef(modelPool, `${providerKey}/${modelKey}`);
    }
  }

  for (const agent of agents) {
    pushModelRef(modelPool, readModel(agent.definition));
  }

  for (const modelId of FALLBACK_MODEL_IDS) {
    pushModelRef(modelPool, modelId);
  }

  return [...modelPool].sort((left, right) => left.localeCompare(right));
}

export function toSelectOptions(pool: string[], currentValue: string): string[] {
  const options = new Set(pool);
  const normalizedCurrent = currentValue.trim();

  if (normalizedCurrent.length > 0) {
    options.add(normalizedCurrent);
  }

  return [...options].sort((left, right) => left.localeCompare(right));
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortAgents(items: AgentItem[], sortMode: SortMode): AgentItem[] {
  if (sortMode === "created-asc") {
    return [...items].sort((left, right) => {
      const byCreated =
        toTimestamp(left.createdAt) - toTimestamp(right.createdAt);
      if (byCreated !== 0) {
        return byCreated;
      }
      return left.key.localeCompare(right.key);
    });
  }

  if (sortMode === "created-desc") {
    return [...items].sort((left, right) => {
      const byCreated =
        toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
      if (byCreated !== 0) {
        return byCreated;
      }
      return right.key.localeCompare(left.key);
    });
  }

  if (sortMode === "key-desc") {
    return [...items].sort((left, right) => right.key.localeCompare(left.key));
  }

  return [...items].sort((left, right) => left.key.localeCompare(right.key));
}
