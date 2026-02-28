import type {
  AgentKeyPool,
  ActiveProfileState,
  AgentDefinitionRecord,
  JsonObject,
  ProfileSnapshotRecord,
  TaskExposureMode
} from "../domain/profile-types.js";
import { isJsonObject, isValidKeyPool } from "../domain/profile-types.js";
import { ProfileServiceError } from "../domain/errors.js";
import type { IProfileStore, ISnapshotStore } from "../domain/store-interfaces.js";
import type {
  IAgentService,
  AgentRegistrySyncStatus
} from "../domain/service-interfaces.js";
import type {
  AgentRegistryDocument,
  AgentRegistryEntry
} from "./agent-registry.js";
import {
  projectRegistryToAgentsMarkdown,
  projectRegistryToOpencodeConfig,
  resolveAgentRegistry,
  toRegistryJsonObject
} from "./agent-registry.js";
import { evaluateRegistryDrift } from "./drift-evaluator.js";
import {
  ensureValidConfigKey,
  normalizeAgentKeyPool
} from "./validation-helpers.js";

export class AgentService implements IAgentService {
  private readonly profileStore: IProfileStore;
  private readonly snapshotStore: ISnapshotStore;

  constructor(profileStore: IProfileStore, snapshotStore: ISnapshotStore) {
    this.profileStore = profileStore;
    this.snapshotStore = snapshotStore;
  }

  async ensureAgentRegistryInitialized(): Promise<void> {
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

  async listAgents(): Promise<AgentDefinitionRecord[]> {
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

  async synchronizeAgentsRegistry(): Promise<{
    profile: ActiveProfileState;
    snapshot: ProfileSnapshotRecord;
  }> {
    const profile = await this.profileStore.loadActiveProfile();
    const { registry } = await this.resolveRegistry(profile);
    registry.updatedAt = new Date().toISOString();
    return this.persistRegistryMutation(profile, registry, "agents-sync");
  }

  async createAgent(
    key: string,
    definition: JsonObject,
    keyPool: AgentKeyPool = "any"
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
    const normalizedKey = ensureValidConfigKey("agent", key);

    if (!isJsonObject(definition)) {
      throw new ProfileServiceError(
        "INVALID_BODY",
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
      keyPool: isValidKeyPool(keyPool) ? keyPool : "any"
    });
    registry.updatedAt = now;

    return this.persistRegistryMutation(profile, registry, "agent-create");
  }

  async updateAgent(
    key: string,
    definition: JsonObject,
    keyPool?: AgentKeyPool
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
    const normalizedKey = ensureValidConfigKey("agent", key);

    if (!isJsonObject(definition)) {
      throw new ProfileServiceError(
        "INVALID_BODY",
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

  async deleteAgent(
    key: string
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
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

  async renameAgent(
    fromKey: string,
    toKey: string
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
    const normalizedFromKey = ensureValidConfigKey("agent", fromKey);
    const normalizedToKey = ensureValidConfigKey("agent", toKey);

    if (normalizedFromKey === normalizedToKey) {
      throw new ProfileServiceError(
        "INVALID_KEY",
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

  // ── Private helpers ──────────────────────────────────────────────

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
      keyPool: isValidKeyPool(entry.keyPool) ? entry.keyPool : "any",
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
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
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
