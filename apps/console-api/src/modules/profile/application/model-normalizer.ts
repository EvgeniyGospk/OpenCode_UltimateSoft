import type { AgentKeyPool, JsonObject, TaskExposureMode } from "../domain/profile-types.js";


interface SuffixRule { suffix: string; pool?: AgentKeyPool; }

const POOL_SUFFIX_RULES: SuffixRule[] = [
  { suffix: "-pool-soft", pool: "software" },
  { suffix: "-pool-default", pool: "default" },
  { suffix: "-soft", pool: "software" },    // legacy
  { suffix: "-default", pool: "default" },   // legacy
];

const REASONING_SUFFIXES = ["-extra-high", "-extra_high", "-high", "-medium", "-low"];

export function splitModelRef(model: string) {
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

export function joinModelRef(provider: string, modelId: string, hasProvider: boolean) {
  return hasProvider ? `${provider}/${modelId}` : modelId;
}

export function inferPoolFromModelId(modelId: string): AgentKeyPool | null {
  for (const rule of POOL_SUFFIX_RULES) {
    if (modelId.endsWith(rule.suffix)) {
      return rule.pool ?? null;
    }
  }

  return null;
}

export function stripPoolSuffixFromModelId(modelId: string) {
  for (const rule of POOL_SUFFIX_RULES) {
    if (modelId.endsWith(rule.suffix)) {
      return modelId.slice(0, -rule.suffix.length);
    }
  }

  return modelId;
}

export function stripTaskReasoningSuffixFromModelId(modelId: string) {
  const lower = modelId.toLowerCase();
  for (const suffix of REASONING_SUFFIXES) {
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

export function normalizeDefinitionForTaskExposure(
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

export function normalizeDefinitionForRegistry(definition: JsonObject) {
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

export function applyDefinitionForProjection(
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
  const poolRule = POOL_SUFFIX_RULES.find((r) => r.pool === keyPool);
  const suffix = taskExposure === "off" && poolRule ? poolRule.suffix : "";

  nextDefinition.model = joinModelRef(
    parsed.provider,
    `${baseModelId}${suffix}`,
    parsed.hasProvider
  );

  return nextDefinition;
}
