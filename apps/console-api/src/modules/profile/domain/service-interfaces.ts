import type {
  ActiveProfileState,
  AgentDefinitionRecord,
  AgentKeyPool,
  JsonObject,
  ProfileSnapshotRecord,
  ProfileSummary,
  ProviderDefinitionRecord
} from "./profile-types.js";

/**
 * Narrow role interface for agent CRUD and registry operations.
 * Consumers that only need agent management should depend on this
 * instead of the full ProfileService.
 */
export interface IAgentService {
  ensureAgentRegistryInitialized(): Promise<void>;
  listAgents(): Promise<AgentDefinitionRecord[]>;
  createAgent(
    key: string,
    definition: JsonObject,
    keyPool?: AgentKeyPool
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }>;
  updateAgent(
    key: string,
    definition: JsonObject,
    keyPool?: AgentKeyPool
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }>;
  deleteAgent(
    key: string
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }>;
  renameAgent(
    fromKey: string,
    toKey: string
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }>;
  getAgentRegistrySyncStatus(): Promise<AgentRegistrySyncStatus>;
  synchronizeAgentsRegistry(): Promise<{
    profile: ActiveProfileState;
    snapshot: ProfileSnapshotRecord;
  }>;
}

/**
 * Narrow role interface for provider operations.
 */
export interface IProviderService {
  listProviders(): Promise<ProviderDefinitionRecord[]>;
  updateProvider(
    key: string,
    definition: JsonObject
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }>;
}

/**
 * Narrow role interface for backup / restore operations.
 */
export interface IBackupService {
  listBackups(): Promise<ProfileSnapshotRecord[]>;
  restoreBackup(
    snapshotId: string
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }>;
}

/**
 * Narrow role interface for profile-level queries and saves.
 */
export interface IProfileCoreService {
  listProfiles(): Promise<ProfileSummary[]>;
  getActiveProfile(): Promise<ActiveProfileState>;
  saveActiveProfile(input: SaveActiveProfileInput): Promise<{
    profile: ActiveProfileState;
    snapshot: ProfileSnapshotRecord;
  }>;
}

/**
 * Input for saving the active profile. Re-declared here so the
 * domain interface is self-contained.
 */
export interface SaveActiveProfileInput {
  opencodeJson?: JsonObject;
  ohMyOpencodeJson?: JsonObject;
  agentsMarkdown?: string;
}

/**
 * Status returned by agent registry sync checks.
 */
export interface AgentRegistrySyncStatus {
  inSync: boolean;
  registryExists: boolean;
  issues: string[];
}
