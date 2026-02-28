import type { AgentKeyPool, JsonObject, TaskExposureMode } from "../domain/profile-types.js";
import { isJsonObject, isValidKeyPool } from "../domain/profile-types.js";
import { ProfileServiceError } from "../domain/errors.js";

export { isValidKeyPool };

export const AGENT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

export function normalizeConfigKey(key: string): string {
  return key.trim();
}

export function getObjectField(config: JsonObject, field: string): JsonObject {
  const value = config[field];
  if (isJsonObject(value)) {
    return value;
  }

  return {};
}

export function getOrCreateObjectField(config: JsonObject, field: string): JsonObject {
  const value = config[field];
  if (isJsonObject(value)) {
    return value;
  }

  const created: JsonObject = {};
  config[field] = created;
  return created;
}

export function ensureValidConfigKey(kind: string, key: string): string {
  const normalized = normalizeConfigKey(key);
  const isValid = AGENT_KEY_PATTERN.test(normalized);

  if (!isValid) {
    throw new ProfileServiceError(
      "INVALID_KEY",
      `Invalid ${kind} key. Use letters, numbers, dot, underscore, or dash.`,
      400,
      { key: normalized }
    );
  }

  return normalized;
}

export function normalizeAgentKeyPool(value: unknown, fallback: AgentKeyPool = "any") {
  if (isValidKeyPool(value)) {
    return value;
  }

  return fallback;
}

export function toIsoString(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
}

export function normalizeTaskExposure(value: unknown): TaskExposureMode {
  if (value === "direct" || value === "alias" || value === "off") {
    return value;
  }

  return "off";
}

export function normalizeKeyPool(value: unknown): AgentKeyPool | null {
  if (isValidKeyPool(value)) {
    return value;
  }

  return null;
}

const DEFAULT_TASK_DIRECT_KEYS = new Set([
  "general",
  "explore",
  "sonnet",
  "opus",
  "codex-search",
  "gemini-analyst",
  "designer"
]);

const DEFAULT_TASK_ALIASES: Record<string, string> = {
  "codex-websearch": "codex-search"
};

/**
 * Traverse `config.agent.build.permission.task` safely, returning
 * the task section if every intermediate level is a JsonObject, or
 * `null` otherwise.
 *
 * Exported so that `agent-registry.ts` (or any other module) can
 * adopt the same traversal without duplicating the 4-deep check.
 */
export function readBuildTaskSection(config: JsonObject): JsonObject | null {
  const agentSection = config.agent;
  if (!isJsonObject(agentSection)) return null;

  const buildDefinition = agentSection.build;
  if (!isJsonObject(buildDefinition)) return null;

  const permission = buildDefinition.permission;
  if (!isJsonObject(permission)) return null;

  return isJsonObject(permission.task) ? permission.task : null;
}

export function inferTaskMetadataForKey(key: string, allowedBuildTaskKeys: Set<string>) {
  if (key in DEFAULT_TASK_ALIASES) {
    return {
      taskExposure: "alias" as const,
      taskAlias: DEFAULT_TASK_ALIASES[key]
    };
  }

  if (allowedBuildTaskKeys.has(key) || DEFAULT_TASK_DIRECT_KEYS.has(key)) {
    return {
      taskExposure: "direct" as const
    };
  }

  return {
    taskExposure: "off" as const
  };
}
