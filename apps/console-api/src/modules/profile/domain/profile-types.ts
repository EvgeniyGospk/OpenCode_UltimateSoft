export type JsonObject = Record<string, unknown>;
export type TaskExposureMode = "off" | "direct" | "alias";
export type AgentKeyPool = "any" | "software" | "default";

export interface ProfileSummary {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
}

export interface ActiveProfileState extends ProfileSummary {
  updatedAt: string;
  opencodeJson: JsonObject;
  ohMyOpencodeJson: JsonObject;
  agentsMarkdown: string;
  agentPrompts: Record<string, string>;
}

export interface AgentDefinitionRecord {
  key: string;
  definition: JsonObject;
  createdAt: string;
  updatedAt: string;
  taskExposure: TaskExposureMode;
  keyPool: AgentKeyPool;
  taskAlias?: string;
}

export interface ProviderDefinitionRecord {
  key: string;
  definition: JsonObject;
}

export interface ProfileManagedPaths {
  profileDir: string;
  opencodePath: string;
  ohMyOpencodePath: string;
  agentsPath: string;
  agentDirPath: string;
  agentRegistryPath: string;
}

export interface ProfileSnapshotRecord {
  id: string;
  profilePath: string;
  createdAt: string;
  reason: string;
  relativePaths: string[];
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_KEY_POOLS: ReadonlySet<string> = new Set<AgentKeyPool>([
  "any",
  "software",
  "default"
]);

/**
 * Type guard that checks whether a value is a valid AgentKeyPool literal.
 * Centralises the `value === "any" || "software" || "default"` check that
 * was previously duplicated across multiple normaliser functions.
 */
export function isValidKeyPool(value: unknown): value is AgentKeyPool {
  return typeof value === "string" && VALID_KEY_POOLS.has(value);
}
