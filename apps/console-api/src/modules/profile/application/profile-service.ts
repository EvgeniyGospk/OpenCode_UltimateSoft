import type {
  ActiveProfileState,
  ProfileSnapshotRecord,
  ProfileSummary
} from "../domain/profile-types.js";
import { ProfileServiceError } from "../domain/errors.js";
import type { IProfileStore, ISnapshotStore } from "../domain/store-interfaces.js";
import type {
  IProfileCoreService,
  SaveActiveProfileInput
} from "../domain/service-interfaces.js";
import type { IAgentService } from "../domain/service-interfaces.js";

export { ProfileServiceError } from "../domain/errors.js";

export type {
  IAgentService,
  IProviderService,
  IBackupService,
  IProfileCoreService,
  SaveActiveProfileInput,
  AgentRegistrySyncStatus
} from "../domain/service-interfaces.js";

/**
 * Core profile operations: list, get active, and save.
 *
 * Agent-registry synchronisation after save is delegated to the
 * injected `IAgentService` so that this class stays focused on
 * profile-level concerns.
 */
export class ProfileCoreService implements IProfileCoreService {
  private readonly profileStore: IProfileStore;
  private readonly snapshotStore: ISnapshotStore;
  private readonly agentService: IAgentService;

  constructor(
    profileStore: IProfileStore,
    snapshotStore: ISnapshotStore,
    agentService: IAgentService
  ) {
    this.profileStore = profileStore;
    this.snapshotStore = snapshotStore;
    this.agentService = agentService;
  }

  async listProfiles(): Promise<ProfileSummary[]> {
    return this.profileStore.listProfiles();
  }

  async getActiveProfile(): Promise<ActiveProfileState> {
    return this.profileStore.loadActiveProfile();
  }

  async saveActiveProfile(
    input: SaveActiveProfileInput
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
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

    await this.agentService.ensureAgentRegistryInitialized();

    const snapshot = await this.snapshotStore.createSnapshot(profile.path, "profile-save");
    const updatedProfile = await this.profileStore.loadActiveProfile();

    return {
      profile: updatedProfile,
      snapshot
    };
  }
}

/**
 * @deprecated Import `ProfileCoreService` from this module, or use
 * `createServices()` from `./composition.js` instead.
 *
 * Backward-compatible re-export kept because
 * `sync-agent-registry.ts` imports `createProfileService` from here.
 */
export { createProfileService } from "./composition.js";
