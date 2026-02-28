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
