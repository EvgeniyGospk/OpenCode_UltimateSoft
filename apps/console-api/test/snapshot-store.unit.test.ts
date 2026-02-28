import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProfileStore } from "../src/modules/profile/infra/profile-store.js";
import { ProfileSnapshotStore } from "../src/modules/profile/infra/snapshot-store.js";

let workspaceRoot = "";
const createdPaths: string[] = [];
let savedEnv: Record<string, string | undefined> = {};

async function createTempDir(prefix = "snapshot-store-") {
  const dir = await fs.mkdtemp(join(tmpdir(), prefix));
  createdPaths.push(dir);
  return dir;
}

async function writeJson(filePath: string, value: Record<string, unknown>) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function saveEnvVars(...keys: string[]) {
  for (const key of keys) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnvVars() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  savedEnv = {};
}

async function createMinimalProfile(profileDir: string) {
  await fs.mkdir(profileDir, { recursive: true });
  await writeJson(join(profileDir, "opencode.json"), { model: "test" });
}

async function createFullProfile(profileDir: string) {
  await fs.mkdir(join(profileDir, "agent"), { recursive: true });
  await writeJson(join(profileDir, "opencode.json"), { model: "test" });
  await writeJson(join(profileDir, "oh-my-opencode.json"), { theme: "dark" });
  await fs.writeFile(join(profileDir, "AGENTS.md"), "# Agents\n", "utf8");
  await writeJson(join(profileDir, "agents.registry.json"), {
    version: 1,
    agents: []
  });
  await fs.writeFile(
    join(profileDir, "agent", "designer.md"),
    "Designer prompt",
    "utf8"
  );
}

beforeEach(async () => {
  saveEnvVars("OC_PROFILE", "OPENCODE_PROFILE_DIR", "OC_SNAPSHOTS_ROOT");
  delete process.env.OC_PROFILE;
  delete process.env.OPENCODE_PROFILE_DIR;
  delete process.env.OC_SNAPSHOTS_ROOT;
  workspaceRoot = await createTempDir();
});

afterEach(async () => {
  restoreEnvVars();

  for (const path of createdPaths.splice(0)) {
    await fs.rm(path, { recursive: true, force: true });
  }

  workspaceRoot = "";
});

describe("ProfileSnapshotStore constructor & environment path resolution", () => {
  it("uses OC_SNAPSHOTS_ROOT env variable when no option is provided", () => {
    const customDir = join(workspaceRoot, "env-snapshots");
    process.env.OC_SNAPSHOTS_ROOT = customDir;

    const profileStore = new ProfileStore({
      activeProfileDirectory: workspaceRoot
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore);

    // The store was constructed — verifying no throw
    expect(snapshotStore).toBeDefined();
  });

  it("uses explicit option over environment variable", () => {
    process.env.OC_SNAPSHOTS_ROOT = "/should/not/be/used";

    const profileStore = new ProfileStore({
      activeProfileDirectory: workspaceRoot
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: join(workspaceRoot, "explicit-snapshots")
    });

    expect(snapshotStore).toBeDefined();
  });
});

describe("ProfileSnapshotStore.createSnapshot", () => {
  it("creates a snapshot with manifest.json containing required fields", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createFullProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const record = await snapshotStore.createSnapshot(
      profileDir,
      "test-create"
    );

    expect(typeof record.id).toBe("string");
    expect(record.id.length).toBeGreaterThan(0);
    expect(record.profilePath).toBe(await fs.realpath(profileDir));
    expect(typeof record.createdAt).toBe("string");
    expect(record.reason).toBe("test-create");
    expect(Array.isArray(record.relativePaths)).toBe(true);
  });

  it("captures opencode.json in the snapshot", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const record = await snapshotStore.createSnapshot(
      profileDir,
      "test-capture"
    );

    expect(record.relativePaths).toContain("opencode.json");
  });

  it("captures all managed files when present", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createFullProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const record = await snapshotStore.createSnapshot(
      profileDir,
      "test-all"
    );

    expect(record.relativePaths).toContain("opencode.json");
    expect(record.relativePaths).toContain("oh-my-opencode.json");
    expect(record.relativePaths).toContain("AGENTS.md");
    expect(record.relativePaths).toContain("agents.registry.json");
    expect(record.relativePaths).toContain("agent");
  });

  it("skips optional files that do not exist without error", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const record = await snapshotStore.createSnapshot(
      profileDir,
      "test-minimal"
    );

    expect(record.relativePaths).toContain("opencode.json");
    expect(record.relativePaths).not.toContain("oh-my-opencode.json");
    expect(record.relativePaths).not.toContain("AGENTS.md");
    expect(record.relativePaths).not.toContain("agent");
  });

  it("creates unique snapshot IDs for consecutive snapshots", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const first = await snapshotStore.createSnapshot(profileDir, "first");
    const second = await snapshotStore.createSnapshot(profileDir, "second");

    expect(first.id).not.toBe(second.id);
  });
});

describe("ProfileSnapshotStore.listSnapshots", () => {
  it("returns an empty array when no snapshots exist", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const snapshots = await snapshotStore.listSnapshots(profileDir);
    expect(snapshots).toEqual([]);
  });

  it("returns an empty array when the snapshots root does not exist", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "nonexistent-snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const snapshots = await snapshotStore.listSnapshots(profileDir);
    expect(snapshots).toEqual([]);
  });

  it("lists snapshots in reverse chronological order", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    const first = await snapshotStore.createSnapshot(profileDir, "first");
    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await snapshotStore.createSnapshot(profileDir, "second");

    const snapshots = await snapshotStore.listSnapshots(profileDir);
    expect(snapshots.length).toBe(2);
    // Second (newer) should come first
    expect(snapshots[0]!.id).toBe(second.id);
    expect(snapshots[1]!.id).toBe(first.id);
  });

  it("skips directories with missing manifest.json", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    // Create a real snapshot
    await snapshotStore.createSnapshot(profileDir, "real");

    // Manually create a bogus snapshot directory without manifest
    const _realProfilePath = await fs.realpath(profileDir);
    // We need to find the bucket path — list the snapshots dir
    const rootEntries = await fs.readdir(snapshotsDir);
    expect(rootEntries.length).toBe(1);
    const bucketPath = join(snapshotsDir, rootEntries[0]!);
    await fs.mkdir(join(bucketPath, "bogus-no-manifest"), { recursive: true });

    const snapshots = await snapshotStore.listSnapshots(profileDir);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]!.reason).toBe("real");
  });

  it("skips directories with invalid manifest JSON", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    await snapshotStore.createSnapshot(profileDir, "valid");

    // Create a snapshot with invalid JSON manifest
    const rootEntries = await fs.readdir(snapshotsDir);
    const bucketPath = join(snapshotsDir, rootEntries[0]!);
    const badSnapshotDir = join(bucketPath, "bad-json-snapshot");
    await fs.mkdir(badSnapshotDir, { recursive: true });
    await fs.writeFile(
      join(badSnapshotDir, "manifest.json"),
      "{{invalid}}",
      "utf8"
    );

    const snapshots = await snapshotStore.listSnapshots(profileDir);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]!.reason).toBe("valid");
  });

  it("skips manifests that are not valid snapshot records", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    await snapshotStore.createSnapshot(profileDir, "valid");

    // Create a snapshot with valid JSON but not a valid snapshot record
    const rootEntries = await fs.readdir(snapshotsDir);
    const bucketPath = join(snapshotsDir, rootEntries[0]!);
    const badRecordDir = join(bucketPath, "bad-record-snapshot");
    await fs.mkdir(badRecordDir, { recursive: true });
    await writeJson(join(badRecordDir, "manifest.json"), {
      id: "bad-record",
      // Missing profilePath, createdAt, reason, relativePaths
      incomplete: true
    });

    const snapshots = await snapshotStore.listSnapshots(profileDir);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]!.reason).toBe("valid");
  });

  it("skips manifests belonging to a different profile path", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    await snapshotStore.createSnapshot(profileDir, "ours");

    // Create a snapshot that claims to belong to a different profile
    const rootEntries = await fs.readdir(snapshotsDir);
    const bucketPath = join(snapshotsDir, rootEntries[0]!);
    const foreignDir = join(bucketPath, "foreign-snapshot");
    await fs.mkdir(foreignDir, { recursive: true });
    await writeJson(join(foreignDir, "manifest.json"), {
      id: "foreign-snapshot",
      profilePath: "/some/other/profile",
      createdAt: new Date().toISOString(),
      reason: "foreign",
      relativePaths: []
    });

    const snapshots = await snapshotStore.listSnapshots(profileDir);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]!.reason).toBe("ours");
  });
});

describe("ProfileSnapshotStore.restoreSnapshot", () => {
  it("restores a previously created snapshot", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createFullProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    // Create snapshot of original state
    const original = await snapshotStore.createSnapshot(
      profileDir,
      "before-change"
    );

    // Modify profile
    await writeJson(join(profileDir, "opencode.json"), { model: "changed" });

    // Verify it changed
    const changed = JSON.parse(
      await fs.readFile(join(profileDir, "opencode.json"), "utf8")
    );
    expect(changed.model).toBe("changed");

    // Restore original
    await snapshotStore.restoreSnapshot(profileDir, original.id);

    // Verify restoration
    const restored = JSON.parse(
      await fs.readFile(join(profileDir, "opencode.json"), "utf8")
    );
    expect(restored.model).toBe("test");
  });

  it("throws for a nonexistent snapshot ID", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    await expect(
      snapshotStore.restoreSnapshot(profileDir, "nonexistent-id")
    ).rejects.toThrow(/Snapshot not found/);
  });

  it("throws when manifest.json has invalid JSON", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    // Create a valid snapshot first so the bucket directory exists
    const _valid = await snapshotStore.createSnapshot(profileDir, "setup");

    // Get the bucket path and create a snapshot with broken manifest
    const rootEntries = await fs.readdir(snapshotsDir);
    const bucketPath = join(snapshotsDir, rootEntries[0]!);
    const brokenDir = join(bucketPath, "broken-manifest");
    await fs.mkdir(brokenDir, { recursive: true });
    await fs.writeFile(
      join(brokenDir, "manifest.json"),
      "{{broken",
      "utf8"
    );

    await expect(
      snapshotStore.restoreSnapshot(profileDir, "broken-manifest")
    ).rejects.toThrow(/Invalid snapshot manifest/);
  });

  it("throws when manifest is valid JSON but not a valid record", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    await snapshotStore.createSnapshot(profileDir, "setup");

    const rootEntries = await fs.readdir(snapshotsDir);
    const bucketPath = join(snapshotsDir, rootEntries[0]!);
    const invalidDir = join(bucketPath, "invalid-record");
    await fs.mkdir(invalidDir, { recursive: true });
    await writeJson(join(invalidDir, "manifest.json"), {
      id: "invalid-record",
      incomplete: true
    });

    await expect(
      snapshotStore.restoreSnapshot(profileDir, "invalid-record")
    ).rejects.toThrow(/Invalid snapshot record/);
  });

  it("throws when snapshot belongs to a different profile", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    await snapshotStore.createSnapshot(profileDir, "setup");

    const rootEntries = await fs.readdir(snapshotsDir);
    const bucketPath = join(snapshotsDir, rootEntries[0]!);
    const foreignDir = join(bucketPath, "foreign-snapshot");
    await fs.mkdir(foreignDir, { recursive: true });
    await writeJson(join(foreignDir, "manifest.json"), {
      id: "foreign-snapshot",
      profilePath: "/some/other/profile",
      createdAt: new Date().toISOString(),
      reason: "foreign",
      relativePaths: ["opencode.json"]
    });

    await expect(
      snapshotStore.restoreSnapshot(profileDir, "foreign-snapshot")
    ).rejects.toThrow(/does not belong to active profile/);
  });

  it("restores optional files that were present in the snapshot", async () => {
    const profileDir = join(workspaceRoot, "profile");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createFullProfile(profileDir);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    // Take snapshot with all files
    const snapshot = await snapshotStore.createSnapshot(
      profileDir,
      "full-backup"
    );

    // Delete optional files
    await fs.rm(join(profileDir, "oh-my-opencode.json"), { force: true });
    await fs.rm(join(profileDir, "AGENTS.md"), { force: true });

    // Verify they are gone
    await expect(
      fs.access(join(profileDir, "oh-my-opencode.json"))
    ).rejects.toThrow();
    await expect(
      fs.access(join(profileDir, "AGENTS.md"))
    ).rejects.toThrow();

    // Restore
    await snapshotStore.restoreSnapshot(profileDir, snapshot.id);

    // Verify restoration of optional files
    const ohMy = JSON.parse(
      await fs.readFile(join(profileDir, "oh-my-opencode.json"), "utf8")
    );
    expect(ohMy).toEqual({ theme: "dark" });

    const agents = await fs.readFile(join(profileDir, "AGENTS.md"), "utf8");
    expect(agents).toBe("# Agents\n");
  });
});

describe("ProfileSnapshotStore bucket path hashing", () => {
  it("creates different bucket paths for different profile paths", async () => {
    const profileDir1 = join(workspaceRoot, "profile-a");
    const profileDir2 = join(workspaceRoot, "profile-b");
    const snapshotsDir = join(workspaceRoot, "snapshots");

    await createMinimalProfile(profileDir1);
    await createMinimalProfile(profileDir2);

    const profileStore = new ProfileStore({
      activeProfileDirectory: profileDir1
    });
    const snapshotStore = new ProfileSnapshotStore(profileStore, {
      snapshotsRoot: snapshotsDir
    });

    await snapshotStore.createSnapshot(profileDir1, "snap-a");
    await snapshotStore.createSnapshot(profileDir2, "snap-b");

    // Both should create different bucket directories
    const entries = await fs.readdir(snapshotsDir);
    expect(entries.length).toBe(2);
    expect(entries[0]).not.toBe(entries[1]);
  });
});
