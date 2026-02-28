import type {
  AgentKeyPool,
  ActiveProfileState,
  AgentDefinitionRecord,
  JsonObject,
  ProfileSnapshotRecord,
  ProfileSummary,
  ProviderDefinitionRecord
} from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";
import type { IProfileStore, ISnapshotStore } from "../domain/store-interfaces.js";
import { ProfileStore } from "../infra/profile-store.js";
import { ProfileSnapshotStore } from "../infra/snapshot-store.js";
import type {
  AgentRegistryDocument,
  AgentRegistryEntry,
  TaskExposureMode
} from "./agent-registry.js";
import {
  evaluateRegistryDrift,
  projectRegistryToAgentsMarkdown,
  projectRegistryToOpencodeConfig,
  resolveAgentRegistry,
  toRegistryJsonObject
} from "./agent-registry.js";

function normalizeConfigKey(key: string): string {
  return key.trim();
}

function getObjectField(config: JsonObject, field: string): JsonObject {
  const value = config[field];
  if (isJsonObject(value)) {
    return value;
  }

  return {};
}

function getOrCreateObjectField(config: JsonObject, field: string): JsonObject {
  const value = config[field];
  if (isJsonObject(value)) {
    return value;
  }

  const created: JsonObject = {};
  config[field] = created;
  return created;
}

function ensureValidConfigKey(kind: string, key: string): string {
  const normalized = normalizeConfigKey(key);
  const isValid = /^[a-z0-9][a-z0-9._-]*$/i.test(normalized);

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

function normalizeAgentKeyPool(value: unknown, fallback: AgentKeyPool = "any") {
  if (value === "any" || value === "software" || value === "default") {
    return value;
  }

  return fallback;
}

export class ProfileServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ProfileServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface SaveActiveProfileInput {
  opencodeJson?: JsonObject;
  ohMyOpencodeJson?: JsonObject;
  agentsMarkdown?: string;
}

interface AgentRegistrySyncStatus {
  inSync: boolean;
  registryExists: boolean;
  issues: string[];
}

export class ProfileService {
  private readonly profileStore: IProfileStore;
  private readonly snapshotStore: ISnapshotStore;

  constructor(profileStore: IProfileStore, snapshotStore: ISnapshotStore) {
    this.profileStore = profileStore;
    this.snapshotStore = snapshotStore;
  }

  async listProfiles(): Promise<ProfileSummary[]> {
    return this.profileStore.listProfiles();
  }

  async ensureAgentRegistryInitialized() {
    const profile = await this.profileStore.loadActiveProfile();
    const registryContext = await this.resolveRegistry(profile);
    const drift = evaluateRegistryDrift(
      profile.opencodeJson,
      profile.agentsMarkdown,
      registryContext.registry
    );

    if (registryContext.source === "file" && drift.inSync) {
      return;
    }

    await this.saveRegistryProjection(profile, registryContext.registry);
  }

  async getActiveProfile(): Promise<ActiveProfileState> {
    return this.profileStore.loadActiveProfile();
  }

  async saveActiveProfile(input: SaveActiveProfileInput) {
    if (
      input.opencodeJson === undefined &&
      input.ohMyOpencodeJson === undefined &&
      input.agentsMarkdown === undefined
    ) {
      throw new ProfileServiceError(
        "EMPTY_UPDATE",
        "Provide at least one field to save.",
        400
      );
    }

    const profile = await this.profileStore.loadActiveProfile();

    if (input.opencodeJson) {
      await this.profileStore.saveOpencodeJson(profile.path, input.opencodeJson);
    }

    if (input.ohMyOpencodeJson) {
      await this.profileStore.saveOhMyOpencodeJson(
        profile.path,
        input.ohMyOpencodeJson
      );
    }

    if (input.agentsMarkdown !== undefined) {
      await this.profileStore.saveAgentsMarkdown(profile.path, input.agentsMarkdown);
    }

    await this.ensureAgentRegistryInitialized();

    const snapshot = await this.snapshotStore.createSnapshot(profile.path, "profile-save");
    const updatedProfile = await this.profileStore.loadActiveProfile();

    return {
      profile: updatedProfile,
      snapshot
    };
  }

  async listAgents() {
    const profile = await this.profileStore.loadActiveProfile();
    const { registry } = await this.resolveRegistry(profile);

    return registry.agents.map((entry) => this.toAgentRecord(entry));
  }

  async getAgentRegistrySyncStatus(): Promise<AgentRegistrySyncStatus> {
    const profile = await this.profileStore.loadActiveProfile();
    const rawRegistry = await this.profileStore.readAgentRegistry(profile.path);
    const { registry } = await this.resolveRegistry(profile);
    const drift = evaluateRegistryDrift(
      profile.opencodeJson,
      profile.agentsMarkdown,
      registry
    );

    return {
      inSync: rawRegistry !== null && drift.inSync,
      registryExists: rawRegistry !== null,
      issues:
        rawRegistry === null
          ? ["agents.registry.json is missing"]
          : drift.issues
    };
  }

  async synchronizeAgentsRegistry() {
    const profile = await this.profileStore.loadActiveProfile();
    const { registry } = await this.resolveRegistry(profile);
    registry.updatedAt = new Date().toISOString();
    return this.persistRegistryMutation(profile, registry, "agents-sync");
  }

  async createAgent(key: string, definition: JsonObject, keyPool: AgentKeyPool = "any") {
    const normalizedKey = ensureValidConfigKey("agent", key);

    if (!isJsonObject(definition)) {
      throw new ProfileServiceError(
        "INVALID_DEFINITION",
        "Agent definition must be an object.",
        400
      );
    }

    const profile = await this.profileStore.loadActiveProfile();
    const { registry } = await this.resolveRegistry(profile);

    if (registry.agents.some((entry) => entry.key === normalizedKey)) {
      throw new ProfileServiceError(
        "AGENT_EXISTS",
        `Agent '${normalizedKey}' already exists.`,
        409
      );
    }

    const now = new Date().toISOString();
    registry.agents.push({
      key: normalizedKey,
      definition: structuredClone(definition),
      createdAt: now,
      updatedAt: now,
      taskExposure: "direct",
      keyPool: normalizeAgentKeyPool(keyPool)
    });
    registry.updatedAt = now;

    return this.persistRegistryMutation(profile, registry, "agent-create");
  }

  async updateAgent(
    key: string,
    definition: JsonObject,
    keyPool?: AgentKeyPool
  ) {
    const normalizedKey = ensureValidConfigKey("agent", key);

    if (!isJsonObject(definition)) {
      throw new ProfileServiceError(
        "INVALID_DEFINITION",
        "Agent definition must be an object.",
        400
      );
    }

    const profile = await this.profileStore.loadActiveProfile();
    const { registry } = await this.resolveRegistry(profile);
    const targetEntry = registry.agents.find((entry) => entry.key === normalizedKey);

    if (!targetEntry) {
      throw new ProfileServiceError(
        "AGENT_NOT_FOUND",
        `Agent '${normalizedKey}' does not exist.`,
        404
      );
    }

    targetEntry.definition = structuredClone(definition);
    targetEntry.keyPool = normalizeAgentKeyPool(keyPool, targetEntry.keyPool);
    targetEntry.updatedAt = new Date().toISOString();
    registry.updatedAt = targetEntry.updatedAt;

    return this.persistRegistryMutation(profile, registry, "agent-update");
  }

  async deleteAgent(key: string) {
    const normalizedKey = ensureValidConfigKey("agent", key);
    const profile = await this.profileStore.loadActiveProfile();
    const { registry } = await this.resolveRegistry(profile);
    const nextAgents = registry.agents.filter((entry) => entry.key !== normalizedKey);

    if (nextAgents.length === registry.agents.length) {
      throw new ProfileServiceError(
        "AGENT_NOT_FOUND",
        `Agent '${normalizedKey}' does not exist.`,
        404
      );
    }

    registry.agents = nextAgents;
    registry.updatedAt = new Date().toISOString();

    return this.persistRegistryMutation(profile, registry, "agent-delete");
  }

  async renameAgent(fromKey: string, toKey: string) {
    const normalizedFromKey = ensureValidConfigKey("agent", fromKey);
    const normalizedToKey = ensureValidConfigKey("agent", toKey);

    if (normalizedFromKey === normalizedToKey) {
      throw new ProfileServiceError(
        "AGENT_RENAME_NOOP",
        "Source and target keys are the same.",
        400
      );
    }

    const profile = await this.profileStore.loadActiveProfile();
    const { registry } = await this.resolveRegistry(profile);
    const sourceEntry = registry.agents.find(
      (entry) => entry.key === normalizedFromKey
    );

    if (!sourceEntry) {
      throw new ProfileServiceError(
        "AGENT_NOT_FOUND",
        `Agent '${normalizedFromKey}' does not exist.`,
        404
      );
    }

    if (registry.agents.some((entry) => entry.key === normalizedToKey)) {
      throw new ProfileServiceError(
        "AGENT_EXISTS",
        `Agent '${normalizedToKey}' already exists.`,
        409
      );
    }

    registry.agents = registry.agents.map((entry) => {
      if (entry.key !== normalizedFromKey) {
        return entry;
      }

      const now = new Date().toISOString();
      const renamed: AgentRegistryEntry = {
        ...entry,
        key: normalizedToKey,
        updatedAt: now
      };

      if (renamed.taskExposure === "alias" && !renamed.taskAlias) {
        renamed.taskAlias = normalizedFromKey;
      }

      return renamed;
    });
    registry.updatedAt = new Date().toISOString();

    return this.persistRegistryMutation(profile, registry, "agent-rename");
  }

  async listProviders() {
    const profile = await this.profileStore.loadActiveProfile();
    const providers = getObjectField(profile.opencodeJson, "provider");
    const records: ProviderDefinitionRecord[] = [];

    for (const [key, definition] of Object.entries(providers)) {
      if (!isJsonObject(definition)) {
        continue;
      }

      records.push({
        key,
        definition
      });
    }

    return records;
  }

  async updateProvider(key: string, definition: JsonObject) {
    const normalizedKey = ensureValidConfigKey("provider", key);

    if (!isJsonObject(definition)) {
      throw new ProfileServiceError(
        "INVALID_DEFINITION",
        "Provider definition must be an object.",
        400
      );
    }

    const profile = await this.profileStore.loadActiveProfile();
    const nextConfig = structuredClone(profile.opencodeJson) as JsonObject;
    const providers = getOrCreateObjectField(nextConfig, "provider");
    providers[normalizedKey] = definition;

    return this.saveMutatedConfig(profile, nextConfig, "provider-update");
  }

  async listBackups(): Promise<ProfileSnapshotRecord[]> {
    const profile = await this.profileStore.loadActiveProfile();
    return this.snapshotStore.listSnapshots(profile.path);
  }

  async restoreBackup(snapshotId: string) {
    const normalizedSnapshotId = snapshotId.trim();
    if (!normalizedSnapshotId) {
      throw new ProfileServiceError(
        "INVALID_SNAPSHOT_ID",
        "Snapshot id cannot be empty.",
        400
      );
    }

    const profile = await this.profileStore.loadActiveProfile();

    try {
      await this.snapshotStore.restoreSnapshot(profile.path, normalizedSnapshotId);
    } catch (error) {
      throw new ProfileServiceError(
        "SNAPSHOT_NOT_FOUND",
        error instanceof Error ? error.message : "Snapshot restore failed.",
        404
      );
    }

    const restoreSnapshot = await this.snapshotStore.createSnapshot(
      profile.path,
      `restore:${normalizedSnapshotId}`
    );
    const updatedProfile = await this.profileStore.loadActiveProfile();

    return {
      profile: updatedProfile,
      snapshot: restoreSnapshot
    };
  }

  private async saveMutatedConfig(
    profile: ActiveProfileState,
    nextConfig: JsonObject,
    reason: string
  ) {
    await this.profileStore.saveOpencodeJson(profile.path, nextConfig);
    const snapshot = await this.snapshotStore.createSnapshot(profile.path, reason);
    const updatedProfile = await this.profileStore.loadActiveProfile();

    return {
      profile: updatedProfile,
      snapshot
    };
  }

  private async resolveRegistry(profile: ActiveProfileState) {
    const rawRegistry = await this.profileStore.readAgentRegistry(profile.path);
    return resolveAgentRegistry(rawRegistry, profile.opencodeJson);
  }

  private toAgentRecord(entry: AgentRegistryEntry): AgentDefinitionRecord {
    return {
      key: entry.key,
      definition: structuredClone(entry.definition),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      taskExposure: entry.taskExposure as TaskExposureMode,
      keyPool: normalizeAgentKeyPool(entry.keyPool),
      taskAlias: entry.taskAlias
    };
  }

  private async saveRegistryProjection(
    profile: ActiveProfileState,
    registry: AgentRegistryDocument
  ) {
    const nextConfig = projectRegistryToOpencodeConfig(profile.opencodeJson, registry);
    const nextAgentsMarkdown = projectRegistryToAgentsMarkdown(
      profile.agentsMarkdown,
      registry
    );

    await this.profileStore.saveAgentRegistry(profile.path, toRegistryJsonObject(registry));
    await this.profileStore.saveOpencodeJson(profile.path, nextConfig);
    await this.profileStore.saveAgentsMarkdown(profile.path, nextAgentsMarkdown);
  }

  private async persistRegistryMutation(
    profile: ActiveProfileState,
    registry: AgentRegistryDocument,
    reason: string
  ) {
    const normalizedRegistry = resolveAgentRegistry(
      toRegistryJsonObject(registry),
      profile.opencodeJson,
      registry.updatedAt
    ).registry;
    normalizedRegistry.updatedAt = registry.updatedAt;

    await this.saveRegistryProjection(profile, normalizedRegistry);
    const snapshot = await this.snapshotStore.createSnapshot(profile.path, reason);
    const updatedProfile = await this.profileStore.loadActiveProfile();

    return {
      profile: updatedProfile,
      snapshot
    };
  }
}

export function createProfileService() {
  const profileStore = new ProfileStore();
  const snapshotStore = new ProfileSnapshotStore(profileStore);

  return new ProfileService(profileStore, snapshotStore);
}
