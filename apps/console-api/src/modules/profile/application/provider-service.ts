import type {
  ActiveProfileState,
  JsonObject,
  ProfileSnapshotRecord,
  ProviderDefinitionRecord
} from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";
import { ProfileServiceError } from "../domain/errors.js";
import type { IProfileStore, ISnapshotStore } from "../domain/store-interfaces.js";
import type { IProviderService } from "../domain/service-interfaces.js";
import {
  ensureValidConfigKey,
  getObjectField,
  getOrCreateObjectField
} from "./validation-helpers.js";

export class ProviderService implements IProviderService {
  private readonly profileStore: IProfileStore;
  private readonly snapshotStore: ISnapshotStore;

  constructor(profileStore: IProfileStore, snapshotStore: ISnapshotStore) {
    this.profileStore = profileStore;
    this.snapshotStore = snapshotStore;
  }

  async listProviders(): Promise<ProviderDefinitionRecord[]> {
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

  async updateProvider(
    key: string,
    definition: JsonObject
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
    const normalizedKey = ensureValidConfigKey("provider", key);

    if (!isJsonObject(definition)) {
      throw new ProfileServiceError(
        "INVALID_BODY",
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

  // ── Private helpers ──────────────────────────────────────────────

  private async saveMutatedConfig(
    profile: ActiveProfileState,
    nextConfig: JsonObject,
    reason: string
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
    await this.profileStore.saveOpencodeJson(profile.path, nextConfig);
    const snapshot = await this.snapshotStore.createSnapshot(profile.path, reason);
    const updatedProfile = await this.profileStore.loadActiveProfile();

    return {
      profile: updatedProfile,
      snapshot
    };
  }
}
