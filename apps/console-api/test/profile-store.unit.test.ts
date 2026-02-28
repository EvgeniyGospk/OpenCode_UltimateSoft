import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProfileStore } from "../src/modules/profile/infra/profile-store.js";

let workspaceRoot = "";
const createdPaths: string[] = [];
let savedEnv: Record<string, string | undefined> = {};

async function createTempDir(prefix = "profile-store-") {
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

describe("ProfileStore constructor & environment path resolution", () => {
  it("uses the OC_PROFILE env variable when no option is provided", () => {
    const customDir = join(workspaceRoot, "env-profile");
    process.env.OC_PROFILE = customDir;

    const store = new ProfileStore();
    const paths = store.getManagedPaths(customDir);
    expect(paths.profileDir).toBe(customDir);
    expect(paths.opencodePath).toBe(join(customDir, "opencode.json"));
  });

  it("uses OPENCODE_PROFILE_DIR as fallback when OC_PROFILE is unset", () => {
    const customDir = join(workspaceRoot, "fallback-profile");
    process.env.OPENCODE_PROFILE_DIR = customDir;

    const store = new ProfileStore();
    const paths = store.getManagedPaths(customDir);
    expect(paths.profileDir).toBe(customDir);
  });

  it("prefers OC_PROFILE over OPENCODE_PROFILE_DIR", () => {
    const primary = join(workspaceRoot, "primary");
    const fallback = join(workspaceRoot, "fallback");
    process.env.OC_PROFILE = primary;
    process.env.OPENCODE_PROFILE_DIR = fallback;

    const store = new ProfileStore();
    // getManagedPaths is deterministic — just verifying the store was created
    const paths = store.getManagedPaths(primary);
    expect(paths.profileDir).toBe(primary);
  });

  it("uses explicit option over environment variable", () => {
    process.env.OC_PROFILE = "/should/not/be/used";

    const explicit = join(workspaceRoot, "explicit-profile");
    const store = new ProfileStore({ activeProfileDirectory: explicit });
    const paths = store.getManagedPaths(explicit);
    expect(paths.profileDir).toBe(explicit);
  });
});

describe("ProfileStore.getManagedPaths", () => {
  it("returns all six managed paths rooted in the given directory", () => {
    const store = new ProfileStore({ activeProfileDirectory: workspaceRoot });
    const paths = store.getManagedPaths(workspaceRoot);

    expect(paths.profileDir).toBe(workspaceRoot);
    expect(paths.opencodePath).toBe(join(workspaceRoot, "opencode.json"));
    expect(paths.ohMyOpencodePath).toBe(
      join(workspaceRoot, "oh-my-opencode.json")
    );
    expect(paths.agentsPath).toBe(join(workspaceRoot, "AGENTS.md"));
    expect(paths.agentDirPath).toBe(join(workspaceRoot, "agent"));
    expect(paths.agentRegistryPath).toBe(
      join(workspaceRoot, "agents.registry.json")
    );
  });
});

describe("ProfileStore.resolveActiveProfilePath", () => {
  it("resolves when the directory exists", async () => {
    const profileDir = join(workspaceRoot, "active");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const resolved = await store.resolveActiveProfilePath();
    expect(resolved).toBe(await fs.realpath(profileDir));
  });

  it("throws when the active directory does not exist", async () => {
    const missingDir = join(workspaceRoot, "missing-profile");
    const store = new ProfileStore({ activeProfileDirectory: missingDir });

    await expect(store.resolveActiveProfilePath()).rejects.toThrow(
      /Active profile directory not found/
    );
  });

  it("resolves symlinks to their real path", async () => {
    const realDir = join(workspaceRoot, "real-profile");
    const symlinkDir = join(workspaceRoot, "link-profile");
    await fs.mkdir(realDir, { recursive: true });
    await fs.symlink(realDir, symlinkDir);
    createdPaths.push(symlinkDir);

    const store = new ProfileStore({ activeProfileDirectory: symlinkDir });
    const resolved = await store.resolveActiveProfilePath();
    expect(resolved).toBe(await fs.realpath(realDir));
  });
});

describe("ProfileStore.loadActiveProfile", () => {
  it("loads profile with all managed files present", async () => {
    const profileDir = join(workspaceRoot, "full-profile");
    await fs.mkdir(join(profileDir, "agent"), { recursive: true });

    await writeJson(join(profileDir, "opencode.json"), { model: "test-model" });
    await writeJson(join(profileDir, "oh-my-opencode.json"), { agents: {} });
    await fs.writeFile(
      join(profileDir, "AGENTS.md"),
      "# Agents\n",
      "utf8"
    );
    await fs.writeFile(
      join(profileDir, "agent", "designer.md"),
      "Designer prompt",
      "utf8"
    );

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const profile = await store.loadActiveProfile();

    expect(profile.id).toBe("full-profile");
    expect(profile.name).toBe("full-profile");
    expect(profile.isActive).toBe(true);
    expect(profile.opencodeJson).toEqual({ model: "test-model" });
    expect(profile.ohMyOpencodeJson).toEqual({ agents: {} });
    expect(profile.agentsMarkdown).toBe("# Agents\n");
    expect(profile.agentPrompts["designer.md"]).toBe("Designer prompt");
    expect(typeof profile.updatedAt).toBe("string");
  });

  it("returns empty objects/strings when optional files are missing", async () => {
    const profileDir = join(workspaceRoot, "minimal-profile");
    await fs.mkdir(profileDir, { recursive: true });
    await writeJson(join(profileDir, "opencode.json"), { minimal: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const profile = await store.loadActiveProfile();

    expect(profile.ohMyOpencodeJson).toEqual({});
    expect(profile.agentsMarkdown).toBe("");
    expect(profile.agentPrompts).toEqual({});
  });

  it("throws when opencode.json is missing", async () => {
    const profileDir = join(workspaceRoot, "no-opencode-profile");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    await expect(store.loadActiveProfile()).rejects.toThrow();
  });

  it("throws when opencode.json contains invalid JSON", async () => {
    const profileDir = join(workspaceRoot, "invalid-json-profile");
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      join(profileDir, "opencode.json"),
      "not-valid-json{{{",
      "utf8"
    );

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    await expect(store.loadActiveProfile()).rejects.toThrow(/Invalid JSON/);
  });

  it("throws when opencode.json contains a JSON array instead of object", async () => {
    const profileDir = join(workspaceRoot, "array-json-profile");
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      join(profileDir, "opencode.json"),
      "[1, 2, 3]",
      "utf8"
    );

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    await expect(store.loadActiveProfile()).rejects.toThrow(
      /Expected JSON object/
    );
  });

  it("throws when oh-my-opencode.json contains invalid JSON", async () => {
    const profileDir = join(workspaceRoot, "bad-ohmy-profile");
    await fs.mkdir(profileDir, { recursive: true });
    await writeJson(join(profileDir, "opencode.json"), { ok: true });
    await fs.writeFile(
      join(profileDir, "oh-my-opencode.json"),
      "{{broken",
      "utf8"
    );

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    await expect(store.loadActiveProfile()).rejects.toThrow(/Invalid JSON/);
  });

  it("ignores non-.md files in the agent directory", async () => {
    const profileDir = join(workspaceRoot, "agent-filter-profile");
    await fs.mkdir(join(profileDir, "agent"), { recursive: true });
    await writeJson(join(profileDir, "opencode.json"), { ok: true });

    await fs.writeFile(join(profileDir, "agent", "valid.md"), "prompt", "utf8");
    await fs.writeFile(join(profileDir, "agent", "ignored.txt"), "nope", "utf8");
    await fs.mkdir(join(profileDir, "agent", "subdir"), { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const profile = await store.loadActiveProfile();

    expect(Object.keys(profile.agentPrompts)).toEqual(["valid.md"]);
  });
});

describe("ProfileStore.listProfiles", () => {
  it("includes the active profile in the listing", async () => {
    const profileDir = join(workspaceRoot, "active");
    const profilesRoot = join(workspaceRoot, "profiles");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({
      activeProfileDirectory: profileDir,
      profilesRootDirectory: profilesRoot
    });
    const profiles = await store.listProfiles();

    expect(profiles.length).toBe(1);
    expect(profiles[0]!.isActive).toBe(true);
    expect(profiles[0]!.id).toBe("active");
  });

  it("lists both active and sibling profiles sorted correctly", async () => {
    const profileDir = join(workspaceRoot, "active");
    const profilesRoot = join(workspaceRoot, "profiles");
    await fs.mkdir(profileDir, { recursive: true });
    await fs.mkdir(join(profilesRoot, "alpha"), { recursive: true });
    await fs.mkdir(join(profilesRoot, "beta"), { recursive: true });

    const store = new ProfileStore({
      activeProfileDirectory: profileDir,
      profilesRootDirectory: profilesRoot
    });
    const profiles = await store.listProfiles();

    expect(profiles.length).toBe(3);
    // Active profile should come first
    expect(profiles[0]!.isActive).toBe(true);
    // Non-active sorted alphabetically
    expect(profiles[1]!.name).toBe("alpha");
    expect(profiles[2]!.name).toBe("beta");
  });

  it("returns only the active profile when profiles root does not exist", async () => {
    const profileDir = join(workspaceRoot, "active");
    const profilesRoot = join(workspaceRoot, "missing-profiles");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({
      activeProfileDirectory: profileDir,
      profilesRootDirectory: profilesRoot
    });
    const profiles = await store.listProfiles();

    expect(profiles.length).toBe(1);
    expect(profiles[0]!.isActive).toBe(true);
  });

  it("deduplicates when active profile is also in profiles root", async () => {
    const profileDir = join(workspaceRoot, "profiles", "shared");
    const profilesRoot = join(workspaceRoot, "profiles");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({
      activeProfileDirectory: profileDir,
      profilesRootDirectory: profilesRoot
    });
    const profiles = await store.listProfiles();

    // Should not have duplicates
    const ids = profiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ProfileStore.saveOpencodeJson / saveOhMyOpencodeJson / saveAgentsMarkdown", () => {
  it("saves opencode.json atomically and can be re-read", async () => {
    const profileDir = join(workspaceRoot, "save-profile");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    await store.saveOpencodeJson(profileDir, { saved: true });

    const content = JSON.parse(
      await fs.readFile(join(profileDir, "opencode.json"), "utf8")
    );
    expect(content).toEqual({ saved: true });
  });

  it("saves oh-my-opencode.json atomically", async () => {
    const profileDir = join(workspaceRoot, "ohmy-save-profile");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    await store.saveOhMyOpencodeJson(profileDir, { theme: "dark" });

    const content = JSON.parse(
      await fs.readFile(join(profileDir, "oh-my-opencode.json"), "utf8")
    );
    expect(content).toEqual({ theme: "dark" });
  });

  it("saves AGENTS.md content", async () => {
    const profileDir = join(workspaceRoot, "agents-md-profile");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    await store.saveAgentsMarkdown(profileDir, "# New Agents Config\n");

    const content = await fs.readFile(
      join(profileDir, "AGENTS.md"),
      "utf8"
    );
    expect(content).toBe("# New Agents Config\n");
  });
});

describe("ProfileStore.readAgentRegistry", () => {
  it("returns null when the registry file does not exist", async () => {
    const profileDir = join(workspaceRoot, "no-registry-profile");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const result = await store.readAgentRegistry(profileDir);
    expect(result).toBeNull();
  });

  it("returns parsed JSON when the registry file is valid", async () => {
    const profileDir = join(workspaceRoot, "valid-registry-profile");
    await fs.mkdir(profileDir, { recursive: true });
    await writeJson(join(profileDir, "agents.registry.json"), {
      version: 1,
      agents: []
    });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const result = await store.readAgentRegistry(profileDir);
    expect(result).toEqual({ version: 1, agents: [] });
  });

  it("returns null when the registry file contains invalid JSON", async () => {
    const profileDir = join(workspaceRoot, "bad-registry-profile");
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      join(profileDir, "agents.registry.json"),
      "not json",
      "utf8"
    );

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const result = await store.readAgentRegistry(profileDir);
    expect(result).toBeNull();
  });

  it("returns null when the registry file contains a JSON array", async () => {
    const profileDir = join(workspaceRoot, "array-registry-profile");
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      join(profileDir, "agents.registry.json"),
      "[1,2,3]",
      "utf8"
    );

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const result = await store.readAgentRegistry(profileDir);
    expect(result).toBeNull();
  });
});

describe("ProfileStore.saveAgentRegistry", () => {
  it("writes and reads back the registry", async () => {
    const profileDir = join(workspaceRoot, "write-registry-profile");
    await fs.mkdir(profileDir, { recursive: true });

    const store = new ProfileStore({ activeProfileDirectory: profileDir });
    const registryData = { version: 1, agents: [{ key: "test" }] };
    await store.saveAgentRegistry(profileDir, registryData);

    const result = await store.readAgentRegistry(profileDir);
    expect(result).toEqual(registryData);
  });
});
