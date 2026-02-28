import { randomUUID, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ProfileSnapshotRecord } from "../domain/profile-types.js";
import type { IProfilePathResolver, ISnapshotStore } from "../domain/store-interfaces.js";
import { atomicWriteText, fsyncDirectory } from "./atomic-writer.js";
import { expandHomeDirectory, ignoreEnoent, isErrnoError } from "./fs-utils.js";

const DEFAULT_SNAPSHOTS_ROOT = "~/.local/share/opencode-console/snapshots";

function isSnapshotRecord(value: unknown): value is ProfileSnapshotRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.profilePath === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.reason === "string" &&
    Array.isArray(record.relativePaths)
  );
}

interface SnapshotStoreOptions {
  snapshotsRoot?: string;
}

export class ProfileSnapshotStore implements ISnapshotStore {
  private readonly snapshotsRoot: string;
  private readonly profilePathResolver: IProfilePathResolver;

  constructor(profilePathResolver: IProfilePathResolver, options: SnapshotStoreOptions = {}) {
    const snapshotsRootFromEnv = process.env.OC_SNAPSHOTS_ROOT;
    this.profilePathResolver = profilePathResolver;
    this.snapshotsRoot = resolve(
      expandHomeDirectory(
        options.snapshotsRoot ?? snapshotsRootFromEnv ?? DEFAULT_SNAPSHOTS_ROOT
      )
    );
  }

  private getProfileBucketPath(profilePath: string) {
    const pathHash = createHash("sha1")
      .update(profilePath)
      .digest("hex")
      .slice(0, 10);
    const profileName = basename(profilePath);
    return join(this.snapshotsRoot, `${profileName}-${pathHash}`);
  }

  private async copyFileIfPresent(
    sourcePath: string,
    destinationPath: string,
    relativePath: string,
    relativePaths: string[]
  ) {
    await ignoreEnoent(async () => {
      await fs.copyFile(sourcePath, destinationPath);
      relativePaths.push(relativePath);
    }, undefined);
  }

  async createSnapshot(
    profilePath: string,
    reason: string
  ): Promise<ProfileSnapshotRecord> {
    const resolvedProfilePath = await fs.realpath(profilePath);
    const managedPaths = this.profilePathResolver.getManagedPaths(resolvedProfilePath);
    const profileBucketPath = this.getProfileBucketPath(resolvedProfilePath);
    const snapshotId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const snapshotPath = join(profileBucketPath, snapshotId);
    const relativePaths: string[] = [];

    await fs.mkdir(snapshotPath, { recursive: true });

    try {
      await this.copyFileIfPresent(
        managedPaths.opencodePath,
        join(snapshotPath, "opencode.json"),
        "opencode.json",
        relativePaths
      );
      await this.copyFileIfPresent(
        managedPaths.ohMyOpencodePath,
        join(snapshotPath, "oh-my-opencode.json"),
        "oh-my-opencode.json",
        relativePaths
      );
      await this.copyFileIfPresent(
        managedPaths.agentsPath,
        join(snapshotPath, "AGENTS.md"),
        "AGENTS.md",
        relativePaths
      );
      await this.copyFileIfPresent(
        managedPaths.agentRegistryPath,
        join(snapshotPath, "agents.registry.json"),
        "agents.registry.json",
        relativePaths
      );

      await ignoreEnoent(async () => {
        await fs.cp(managedPaths.agentDirPath, join(snapshotPath, "agent"), {
          recursive: true
        });
        relativePaths.push("agent");
      }, undefined);

      const snapshotRecord: ProfileSnapshotRecord = {
        id: snapshotId,
        profilePath: resolvedProfilePath,
        createdAt: new Date().toISOString(),
        reason,
        relativePaths
      };

      await atomicWriteText(
        join(snapshotPath, "manifest.json"),
        `${JSON.stringify(snapshotRecord, null, 2)}\n`
      );

      return snapshotRecord;
    } catch (error) {
      await fs.rm(snapshotPath, { recursive: true, force: true });
      throw error;
    }
  }

  async listSnapshots(profilePath: string): Promise<ProfileSnapshotRecord[]> {
    const resolvedProfilePath = await fs.realpath(profilePath);
    const profileBucketPath = this.getProfileBucketPath(resolvedProfilePath);

    const entries = await ignoreEnoent(
      () =>
        fs.readdir(profileBucketPath, {
          encoding: "utf8",
          withFileTypes: true
        }),
      [] as import("node:fs").Dirent[]
    );

    const snapshots: ProfileSnapshotRecord[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = join(profileBucketPath, entry.name, "manifest.json");
      const manifestRaw = await ignoreEnoent(
        () => fs.readFile(manifestPath, "utf8"),
        null
      );

      if (manifestRaw === null) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(manifestRaw);
      } catch {
        continue;
      }

      if (!isSnapshotRecord(parsed)) {
        continue;
      }

      if (parsed.profilePath !== resolvedProfilePath) {
        continue;
      }

      snapshots.push(parsed);
    }

    return snapshots.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  private async restoreTextFile(sourcePath: string, targetPath: string) {
    const content = await fs.readFile(sourcePath, "utf8");
    await atomicWriteText(targetPath, content);
  }

  private async restoreDirectory(sourcePath: string, targetPath: string) {
    const parentDirectory = dirname(targetPath);
    const tempPath = join(
      parentDirectory,
      `.restore-${basename(targetPath)}-${process.pid}-${Date.now()}`
    );

    await fs.rm(tempPath, { recursive: true, force: true });

    try {
      await fs.cp(sourcePath, tempPath, { recursive: true });
      await fs.rm(targetPath, { recursive: true, force: true });
      await fs.rename(tempPath, targetPath);
      await fsyncDirectory(parentDirectory);
    } catch (error) {
      await fs.rm(tempPath, { recursive: true, force: true });
      throw error;
    }
  }

  async restoreSnapshot(profilePath: string, snapshotId: string) {
    const resolvedProfilePath = await fs.realpath(profilePath);
    const profileBucketPath = this.getProfileBucketPath(resolvedProfilePath);
    const snapshotPath = join(profileBucketPath, snapshotId);
    const manifestPath = join(snapshotPath, "manifest.json");

    let manifestRaw: string;
    try {
      manifestRaw = await fs.readFile(manifestPath, "utf8");
    } catch (error) {
      if (isErrnoError(error) && error.code === "ENOENT") {
        throw new Error(`Snapshot not found: ${snapshotId}`, { cause: error });
      }

      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestRaw);
    } catch (error) {
      throw new Error(`Invalid snapshot manifest: ${snapshotId}`, {
        cause: error
      });
    }

    if (!isSnapshotRecord(parsed)) {
      throw new Error(`Invalid snapshot record: ${snapshotId}`);
    }

    if (parsed.profilePath !== resolvedProfilePath) {
      throw new Error(`Snapshot ${snapshotId} does not belong to active profile`);
    }

    const managedPaths = this.profilePathResolver.getManagedPaths(resolvedProfilePath);
    const opencodeSnapshotPath = join(snapshotPath, "opencode.json");
    const ohMySnapshotPath = join(snapshotPath, "oh-my-opencode.json");
    const agentsSnapshotPath = join(snapshotPath, "AGENTS.md");
    const agentRegistrySnapshotPath = join(snapshotPath, "agents.registry.json");
    const promptsSnapshotPath = join(snapshotPath, "agent");

    await this.restoreTextFile(opencodeSnapshotPath, managedPaths.opencodePath);

    await ignoreEnoent(
      () => this.restoreTextFile(ohMySnapshotPath, managedPaths.ohMyOpencodePath),
      undefined
    );

    await ignoreEnoent(
      () => this.restoreTextFile(agentsSnapshotPath, managedPaths.agentsPath),
      undefined
    );

    await ignoreEnoent(
      () =>
        this.restoreTextFile(
          agentRegistrySnapshotPath,
          managedPaths.agentRegistryPath
        ),
      undefined
    );

    await ignoreEnoent(
      () => this.restoreDirectory(promptsSnapshotPath, managedPaths.agentDirPath),
      undefined
    );
  }
}
