import type {
  ActiveProfileState,
  ProfileSnapshotRecord
} from "../domain/profile-types.js";
import { ProfileServiceError } from "../domain/errors.js";
import type { IProfileStore, ISnapshotStore } from "../domain/store-interfaces.js";
import type { IBackupService } from "../domain/service-interfaces.js";

export class BackupService implements IBackupService {
  private readonly profileStore: IProfileStore;
  private readonly snapshotStore: ISnapshotStore;

  constructor(profileStore: IProfileStore, snapshotStore: ISnapshotStore) {
    this.profileStore = profileStore;
    this.snapshotStore = snapshotStore;
  }

  async listBackups(): Promise<ProfileSnapshotRecord[]> {
    const profile = await this.profileStore.loadActiveProfile();
    return this.snapshotStore.listSnapshots(profile.path);
  }

  async restoreBackup(
    snapshotId: string
  ): Promise<{ profile: ActiveProfileState; snapshot: ProfileSnapshotRecord }> {
    const normalizedSnapshotId = snapshotId.trim();
    if (!normalizedSnapshotId) {
      throw new ProfileServiceError(
        "INVALID_KEY",
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
}
