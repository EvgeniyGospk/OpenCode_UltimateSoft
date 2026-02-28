import type {
  ActiveProfileState,
  JsonObject,
  ProfileManagedPaths,
  ProfileSnapshotRecord,
  ProfileSummary
} from "./profile-types.js";

/**
 * Resolves filesystem paths for a given profile directory.
 */
export interface IProfilePathResolver {
  getManagedPaths(profileDirectoryPath: string): ProfileManagedPaths;
  resolveActiveProfilePath(): Promise<string>;
}

/**
 * Read-only operations on profile data.
 */
export interface IProfileReader {
  loadActiveProfile(): Promise<ActiveProfileState>;
  listProfiles(): Promise<ProfileSummary[]>;
  readAgentRegistry(profilePath: string): Promise<JsonObject | null>;
}

/**
 * Write operations on profile data.
 */
export interface IProfileWriter {
  saveOpencodeJson(profilePath: string, nextConfig: JsonObject): Promise<void>;
  saveOhMyOpencodeJson(profilePath: string, nextConfig: JsonObject): Promise<void>;
  saveAgentsMarkdown(profilePath: string, markdown: string): Promise<void>;
  saveAgentRegistry(profilePath: string, nextRegistry: JsonObject): Promise<void>;
}

/**
 * Combined interface for full profile store access.
 * Consumers that only need a subset should depend on
 * IProfilePathResolver, IProfileReader, or IProfileWriter instead.
 */
export interface IProfileStore
  extends IProfilePathResolver, IProfileReader, IProfileWriter {}

/**
 * Abstract interface for managing profile snapshots (backups / restore).
 * Concrete implementations live in infra/ (e.g. ProfileSnapshotStore).
 */
export interface ISnapshotStore {
  createSnapshot(profilePath: string, reason: string): Promise<ProfileSnapshotRecord>;
  listSnapshots(profilePath: string): Promise<ProfileSnapshotRecord[]>;
  restoreSnapshot(profilePath: string, snapshotId: string): Promise<void>;
}
