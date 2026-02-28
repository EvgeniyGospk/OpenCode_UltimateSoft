import type { AgentKeyPool, JsonObject, TaskExposureMode } from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";
import {
  applyRequiredPlugins,
  resolveHomeDir,
  rewriteLegacyPathsInValue
} from "./plugin-resolver.js";
import {
  applyDefinitionForProjection,
  normalizeDefinitionForRegistry,
  normalizeDefinitionForTaskExposure
} from "./model-normalizer.js";
import {
  AGENT_KEY_PATTERN,
  inferTaskMetadataForKey,
  normalizeKeyPool,
  normalizeTaskExposure,
  readBuildTaskSection,
  toIsoString
} from "./validation-helpers.js";

export interface AgentRegistryEntry {
  key: string;
  definition: JsonObject;
  createdAt: string;
  updatedAt: string;
  taskExposure: TaskExposureMode;
  keyPool: AgentKeyPool;
  taskAlias?: string;
}

export interface AgentRegistryDocument {
  version: 1;
  updatedAt: string;
  agents: AgentRegistryEntry[];
}

interface ResolvedAgentRegistry {
  registry: AgentRegistryDocument;
  source: "file" | "bootstrap";
}

export function readAllowedBuildTaskKeys(config: JsonObject): Set<string> {
  const task = readBuildTaskSection(config);
  if (!task) return new Set<string>();

  return new Set(
    Object.entries(task)
      .filter(([key, value]) => value === "allow" && key !== "*")
      .map(([key]) => key)
  );
}

export function normalizeAgentEntry(
  value: unknown,
  now: string,
  allowedBuildTaskKeys: Set<string>
): AgentRegistryEntry | null {
  if (!isJsonObject(value)) return null;
  if (typeof value.key !== "string") return null;

  const key = value.key.trim();
  if (!AGENT_KEY_PATTERN.test(key)) return null;
  if (!isJsonObject(value.definition)) return null;

  const normalizedDefinition = normalizeDefinitionForRegistry(value.definition);
  const createdAt = toIsoString(value.createdAt, now);
  const updatedAt = toIsoString(value.updatedAt, now);
  const inferredTaskMetadata = inferTaskMetadataForKey(key, allowedBuildTaskKeys);
  const taskExposure = normalizeTaskExposure(value.taskExposure);
  const keyPool =
    normalizeKeyPool(value.keyPool) ?? normalizedDefinition.inferredKeyPool;
  const resolvedTaskExposure =
    taskExposure === "off" ? inferredTaskMetadata.taskExposure : taskExposure;
  const explicitAlias =
    typeof value.taskAlias === "string" && value.taskAlias.trim().length > 0
      ? value.taskAlias.trim()
      : undefined;
  const fallbackAlias =
    resolvedTaskExposure === "alias" ? inferredTaskMetadata.taskAlias : undefined;
  const taskAlias =
    resolvedTaskExposure === "alias" ? explicitAlias ?? fallbackAlias : undefined;
  const normalizedForTaskExposure = normalizeDefinitionForTaskExposure(
    normalizedDefinition.definition,
    resolvedTaskExposure
  );

  return {
    key,
    definition: normalizedForTaskExposure,
    createdAt,
    updatedAt,
    taskExposure: resolvedTaskExposure,
    keyPool,
    taskAlias
  };
}

export function buildRegistryFromOpencodeConfig(
  opencodeJson: JsonObject,
  now = new Date().toISOString()
): AgentRegistryDocument {
  const allowedBuildTaskKeys = readAllowedBuildTaskKeys(opencodeJson);
  const agentSection = isJsonObject(opencodeJson.agent) ? opencodeJson.agent : {};
  const agents: AgentRegistryEntry[] = [];
  const baseTimestamp = Date.parse(now);
  let offset = 0;

  for (const [key, definition] of Object.entries(agentSection)) {
    if (!AGENT_KEY_PATTERN.test(key) || !isJsonObject(definition)) {
      continue;
    }

    const normalizedDefinition = normalizeDefinitionForRegistry(definition);
    const taskMetadata = inferTaskMetadataForKey(key, allowedBuildTaskKeys);
    const entryTimestamp = Number.isNaN(baseTimestamp)
      ? now
      : new Date(baseTimestamp + offset).toISOString();
    offset += 1;

    agents.push({
      key,
      definition: normalizeDefinitionForTaskExposure(
        normalizedDefinition.definition,
        taskMetadata.taskExposure
      ),
      createdAt: entryTimestamp,
      updatedAt: entryTimestamp,
      taskExposure: taskMetadata.taskExposure,
      keyPool: normalizedDefinition.inferredKeyPool,
      taskAlias: taskMetadata.taskAlias
    });
  }

  return {
    version: 1,
    updatedAt: now,
    agents
  };
}

export function resolveAgentRegistry(
  rawRegistry: JsonObject | null,
  opencodeJson: JsonObject,
  now = new Date().toISOString()
): ResolvedAgentRegistry {
  if (!isJsonObject(rawRegistry) || rawRegistry.version !== 1) {
    return {
      source: "bootstrap",
      registry: buildRegistryFromOpencodeConfig(opencodeJson, now)
    };
  }

  const allowedBuildTaskKeys = readAllowedBuildTaskKeys(opencodeJson);
  const rawAgents = rawRegistry.agents;

  if (!Array.isArray(rawAgents)) {
    return {
      source: "bootstrap",
      registry: buildRegistryFromOpencodeConfig(opencodeJson, now)
    };
  }

  const deduped = new Set<string>();
  const agents: AgentRegistryEntry[] = [];

  for (const rawAgent of rawAgents) {
    const normalized = normalizeAgentEntry(rawAgent, now, allowedBuildTaskKeys);

    if (!normalized) {
      continue;
    }

    if (deduped.has(normalized.key)) {
      continue;
    }

    deduped.add(normalized.key);
    agents.push(normalized);
  }

  if (agents.length === 0) {
    return {
      source: "bootstrap",
      registry: buildRegistryFromOpencodeConfig(opencodeJson, now)
    };
  }

  return {
    source: "file",
    registry: {
      version: 1,
      updatedAt: toIsoString(rawRegistry.updatedAt, now),
      agents
    }
  };
}

function toAgentMap(entries: AgentRegistryEntry[]): JsonObject {
  const mapped: JsonObject = {};

  for (const entry of entries) {
    mapped[entry.key] = applyDefinitionForProjection(
      entry.definition,
      entry.keyPool,
      entry.taskExposure
    );
  }

  return mapped;
}

function applyBuildTaskPermissions(
  nextConfig: JsonObject,
  registry: AgentRegistryDocument
) {
  const nextAgentSection = isJsonObject(nextConfig.agent) ? nextConfig.agent : {};
  const buildDefinition = isJsonObject(nextAgentSection.build)
    ? nextAgentSection.build
    : null;

  if (!buildDefinition) {
    return;
  }

  const permission = isJsonObject(buildDefinition.permission)
    ? buildDefinition.permission
    : {};
  const existingTask = isJsonObject(permission.task) ? permission.task : {};
  const nextTask: JsonObject = {};

  if (existingTask["*"] === "allow") {
    nextTask["*"] = "allow";
  }

  for (const entry of registry.agents) {
    if (entry.taskExposure === "direct") {
      nextTask[entry.key] = "allow";
      continue;
    }

    if (entry.taskExposure === "alias") {
      nextTask[entry.key] = "allow";
      if (entry.taskAlias) {
        nextTask[entry.taskAlias] = "allow";
      }
    }
  }

  permission.task = nextTask;
  buildDefinition.permission = permission;
  nextAgentSection.build = buildDefinition;
  nextConfig.agent = nextAgentSection;
}

export function projectRegistryToOpencodeConfig(
  opencodeJson: JsonObject,
  registry: AgentRegistryDocument
): JsonObject {
  const nextConfig = structuredClone(opencodeJson);
  const homeDir = resolveHomeDir();
  rewriteLegacyPathsInValue(nextConfig, homeDir);
  nextConfig.agent = toAgentMap(registry.agents);
  applyBuildTaskPermissions(nextConfig, registry);
  applyRequiredPlugins(nextConfig, homeDir);
  return nextConfig;
}

export { projectRegistryToAgentsMarkdown } from "./markdown-renderer.js";
export { evaluateRegistryDrift } from "./drift-evaluator.js";

export function toRegistryJsonObject(registry: AgentRegistryDocument): JsonObject {
  return {
    version: registry.version,
    updatedAt: registry.updatedAt,
    agents: registry.agents.map((entry) => ({
      key: entry.key,
      definition: structuredClone(entry.definition),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      taskExposure: entry.taskExposure,
      keyPool: entry.keyPool,
      ...(entry.taskAlias ? { taskAlias: entry.taskAlias } : {})
    }))
  };
}
