import type {
  ActiveProfileState,
  JsonObject,
  ProfileManagedPaths,
  ProfileSnapshotRecord,
  ProfileSummary
} from "./profile-types.js";

/**
 * Abstract interface for reading/writing profile configuration data.
 * Concrete implementations live in infra/ (e.g. ProfileStore).
 */
export interface IProfileStore {
  getManagedPaths(profileDirectoryPath: string): ProfileManagedPaths;
  resolveActiveProfilePath(): Promise<string>;
  listProfiles(): Promise<ProfileSummary[]>;
  loadActiveProfile(): Promise<ActiveProfileState>;
  saveOpencodeJson(profilePath: string, nextConfig: JsonObject): Promise<void>;
  saveOhMyOpencodeJson(profilePath: string, nextConfig: JsonObject): Promise<void>;
  saveAgentsMarkdown(profilePath: string, markdown: string): Promise<void>;
  readAgentRegistry(profilePath: string): Promise<JsonObject | null>;
  saveAgentRegistry(profilePath: string, nextRegistry: JsonObject): Promise<void>;
}

/**
 * Abstract interface for managing profile snapshots (backups / restore).
 * Concrete implementations live in infra/ (e.g. ProfileSnapshotStore).
 */
export interface ISnapshotStore {
  createSnapshot(profilePath: string, reason: string): Promise<ProfileSnapshotRecord>;
  listSnapshots(profilePath: string): Promise<ProfileSnapshotRecord[]>;
  restoreSnapshot(profilePath: string, snapshotId: string): Promise<void>;
}
