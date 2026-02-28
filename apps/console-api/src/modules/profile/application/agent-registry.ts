import type { AgentKeyPool, JsonObject } from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";
import {
  applyRequiredPlugins,
  readPluginSpecifiers,
  resolveHomeDir,
  rewriteLegacyPathsInValue
} from "./plugin-resolver.js";
import {
  projectRegistryToAgentsMarkdown,
  readManagedBlock
} from "./markdown-renderer.js";

export type TaskExposureMode = "off" | "direct" | "alias";

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

const AGENT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
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

const MODEL_POOL_SUFFIXES = {
  software: "-pool-soft",
  default: "-pool-default"
} as const;
const LEGACY_MODEL_POOL_SUFFIXES = {
  software: "-soft",
  default: "-default"
} as const;
const TASK_REASONING_SUFFIXES = [
  "-extra-high",
  "-extra_high",
  "-high",
  "-medium",
  "-low"
] as const;

function toIsoString(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
}

function normalizeTaskExposure(value: unknown): TaskExposureMode {
  if (value === "direct" || value === "alias" || value === "off") {
    return value;
  }

  return "off";
}

function normalizeKeyPool(value: unknown): AgentKeyPool | null {
  if (value === "any" || value === "software" || value === "default") {
    return value;
  }

  return null;
}

function splitModelRef(model: string) {
  const slashIndex = model.indexOf("/");
  if (slashIndex < 0) {
    return {
      provider: "",
      modelId: model,
      hasProvider: false
    };
  }

  return {
    provider: model.slice(0, slashIndex),
    modelId: model.slice(slashIndex + 1),
    hasProvider: true
  };
}

function joinModelRef(provider: string, modelId: string, hasProvider: boolean) {
  return hasProvider ? `${provider}/${modelId}` : modelId;
}

function inferPoolFromModelId(modelId: string): AgentKeyPool | null {
  if (modelId.endsWith(MODEL_POOL_SUFFIXES.software)) {
    return "software";
  }

  if (modelId.endsWith(MODEL_POOL_SUFFIXES.default)) {
    return "default";
  }

  if (modelId.endsWith(LEGACY_MODEL_POOL_SUFFIXES.software)) {
    return "software";
  }

  if (modelId.endsWith(LEGACY_MODEL_POOL_SUFFIXES.default)) {
    return "default";
  }

  return null;
}

function stripPoolSuffixFromModelId(modelId: string) {
  if (modelId.endsWith(MODEL_POOL_SUFFIXES.software)) {
    return modelId.slice(0, -MODEL_POOL_SUFFIXES.software.length);
  }

  if (modelId.endsWith(MODEL_POOL_SUFFIXES.default)) {
    return modelId.slice(0, -MODEL_POOL_SUFFIXES.default.length);
  }

  if (modelId.endsWith(LEGACY_MODEL_POOL_SUFFIXES.software)) {
    return modelId.slice(0, -LEGACY_MODEL_POOL_SUFFIXES.software.length);
  }

  if (modelId.endsWith(LEGACY_MODEL_POOL_SUFFIXES.default)) {
    return modelId.slice(0, -LEGACY_MODEL_POOL_SUFFIXES.default.length);
  }

  return modelId;
}

function stripTaskReasoningSuffixFromModelId(modelId: string) {
  const lower = modelId.toLowerCase();
  for (const suffix of TASK_REASONING_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return modelId.slice(0, -suffix.length);
    }
  }

  return modelId;
}

function isCodexOpenAiModel(model: string): boolean {
  const parsed = splitModelRef(model);
  if (parsed.provider !== "openai") {
    return false;
  }

  return parsed.modelId.toLowerCase().includes("codex");
}

function normalizeDefinitionForTaskExposure(
  definition: JsonObject,
  taskExposure: TaskExposureMode
) {
  const nextDefinition = structuredClone(definition);
  if (taskExposure === "off") {
    return nextDefinition;
  }

  const rawModel = nextDefinition.model;
  if (typeof rawModel !== "string" || !isCodexOpenAiModel(rawModel)) {
    return nextDefinition;
  }

  const parsed = splitModelRef(rawModel);
  const normalizedModelId = stripTaskReasoningSuffixFromModelId(
    stripPoolSuffixFromModelId(parsed.modelId)
  );

  nextDefinition.model = joinModelRef(
    parsed.provider,
    normalizedModelId,
    parsed.hasProvider
  );

  return nextDefinition;
}

function normalizeDefinitionForRegistry(definition: JsonObject) {
  const nextDefinition = structuredClone(definition);
  const rawModel = nextDefinition.model;

  if (typeof rawModel !== "string") {
    return {
      definition: nextDefinition,
      inferredKeyPool: "any" as AgentKeyPool
    };
  }

  if (!isCodexOpenAiModel(rawModel)) {
    return {
      definition: nextDefinition,
      inferredKeyPool: "any" as AgentKeyPool
    };
  }

  const parsed = splitModelRef(rawModel);
  const inferredFromModel = inferPoolFromModelId(parsed.modelId) ?? "any";
  const strippedModelId = stripPoolSuffixFromModelId(parsed.modelId);
  nextDefinition.model = joinModelRef(
    parsed.provider,
    strippedModelId,
    parsed.hasProvider
  );

  return {
    definition: nextDefinition,
    inferredKeyPool: inferredFromModel
  };
}

function applyDefinitionForProjection(
  definition: JsonObject,
  keyPool: AgentKeyPool,
  taskExposure: TaskExposureMode
): JsonObject {
  const nextDefinition = normalizeDefinitionForTaskExposure(definition, taskExposure);
  const rawModel = nextDefinition.model;

  if (typeof rawModel !== "string" || !isCodexOpenAiModel(rawModel)) {
    return nextDefinition;
  }

  if (taskExposure !== "off") {
    return nextDefinition;
  }

  const parsed = splitModelRef(rawModel);
  const baseModelId = stripPoolSuffixFromModelId(parsed.modelId);
  const suffix =
    taskExposure === "off"
      ? keyPool === "software"
        ? MODEL_POOL_SUFFIXES.software
        : keyPool === "default"
          ? MODEL_POOL_SUFFIXES.default
          : ""
      : "";

  nextDefinition.model = joinModelRef(
    parsed.provider,
    `${baseModelId}${suffix}`,
    parsed.hasProvider
  );

  return nextDefinition;
}

function readAllowedBuildTaskKeys(config: JsonObject): Set<string> {
  const allowed = new Set<string>();
  const agentSection = config.agent;

  if (!isJsonObject(agentSection)) {
    return allowed;
  }

  const buildDefinition = agentSection.build;
  if (!isJsonObject(buildDefinition)) {
    return allowed;
  }

  const permission = buildDefinition.permission;
  if (!isJsonObject(permission)) {
    return allowed;
  }

  const task = permission.task;
  if (!isJsonObject(task)) {
    return allowed;
  }

  for (const [key, value] of Object.entries(task)) {
    if (value !== "allow") {
      continue;
    }

    if (key === "*") {
      continue;
    }

    allowed.add(key);
  }

  return allowed;
}

function inferTaskMetadataForKey(key: string, allowedBuildTaskKeys: Set<string>) {
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

function normalizeAgentEntry(
  value: unknown,
  now: string,
  allowedBuildTaskKeys: Set<string>
): AgentRegistryEntry | null {
  if (!isJsonObject(value)) {
    return null;
  }

  if (typeof value.key !== "string") {
    return null;
  }

  const key = value.key.trim();
  if (!AGENT_KEY_PATTERN.test(key)) {
    return null;
  }

  if (!isJsonObject(value.definition)) {
    return null;
  }

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

function readCurrentTaskMap(opencodeJson: JsonObject): JsonObject {
  const agentSection = opencodeJson.agent;
  if (!isJsonObject(agentSection)) {
    return {};
  }

  const buildDefinition = agentSection.build;
  if (!isJsonObject(buildDefinition)) {
    return {};
  }

  const permission = buildDefinition.permission;
  if (!isJsonObject(permission)) {
    return {};
  }

  return isJsonObject(permission.task) ? permission.task : {};
}

function readPluginList(opencodeJson: JsonObject) {
  return readPluginSpecifiers(opencodeJson);
}

export { projectRegistryToAgentsMarkdown } from "./markdown-renderer.js";

export function evaluateRegistryDrift(
  opencodeJson: JsonObject,
  agentsMarkdown: string,
  registry: AgentRegistryDocument
) {
  const issues: string[] = [];
  const projectedConfig = projectRegistryToOpencodeConfig(opencodeJson, registry);
  const projectedMarkdown = projectRegistryToAgentsMarkdown(agentsMarkdown, registry);

  const currentAgents = isJsonObject(opencodeJson.agent) ? opencodeJson.agent : {};
  const projectedAgents = isJsonObject(projectedConfig.agent)
    ? projectedConfig.agent
    : {};

  if (JSON.stringify(currentAgents) !== JSON.stringify(projectedAgents)) {
    issues.push("opencode.json agent map differs from registry projection");
  }

  const currentTaskMap = readCurrentTaskMap(opencodeJson);
  const projectedTaskMap = readCurrentTaskMap(projectedConfig);
  if (JSON.stringify(currentTaskMap) !== JSON.stringify(projectedTaskMap)) {
    issues.push("build task permissions differ from registry projection");
  }

  const currentPlugins = readPluginList(opencodeJson);
  const projectedPlugins = readPluginList(projectedConfig);
  if (JSON.stringify(currentPlugins) !== JSON.stringify(projectedPlugins)) {
    issues.push("opencode.json plugin list differs from registry projection");
  }

  const currentBlock = readManagedBlock(agentsMarkdown);
  const projectedBlock = readManagedBlock(projectedMarkdown);
  if (currentBlock !== projectedBlock) {
    issues.push("AGENTS.md managed routing block differs from registry projection");
  }

  return {
    inSync: issues.length === 0,
    issues
  };
}

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
