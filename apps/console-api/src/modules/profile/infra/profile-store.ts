import { promises as fs } from "node:fs";
import { basename, join, resolve } from "node:path";
import type {
  ActiveProfileState,
  JsonObject,
  ProfileManagedPaths,
  ProfileSummary
} from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";
import type { IProfileStore } from "../domain/store-interfaces.js";
import { atomicWriteText } from "./atomic-writer.js";
import { expandHomeDirectory, ignoreEnoent, isErrnoError } from "./fs-utils.js";

const DEFAULT_ACTIVE_PROFILE_DIRECTORY = "~/.config/opencode";
const DEFAULT_PROFILES_ROOT_DIRECTORY = "~/.config/opencode-profiles";

async function readOptionalText(filePath: string): Promise<string | null> {
  return ignoreEnoent(() => fs.readFile(filePath, "utf8"), null);
}

function parseJsonObject(filePath: string, rawContent: string): JsonObject {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`Invalid JSON in ${filePath}`);
  }

  if (!isJsonObject(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }

  return parsed;
}

function serializeJson(value: JsonObject) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readAgentPrompts(
  agentDirectoryPath: string
): Promise<Record<string, string>> {
  const entries = await ignoreEnoent(
    () => fs.readdir(agentDirectoryPath, { withFileTypes: true }),
    [] as import("node:fs").Dirent[]
  );

  const prompts: Record<string, string> = {};

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const filePath = join(agentDirectoryPath, entry.name);
    prompts[entry.name] = await fs.readFile(filePath, "utf8");
  }

  return prompts;
}

interface ProfileStoreOptions {
  activeProfileDirectory?: string;
  profilesRootDirectory?: string;
}

export class ProfileStore implements IProfileStore {
  private readonly activeProfileDirectory: string;
  private readonly profilesRootDirectory: string;

  constructor(options: ProfileStoreOptions = {}) {
    const activeFromEnv =
      process.env.OC_PROFILE ?? process.env.OPENCODE_PROFILE_DIR;

    this.activeProfileDirectory = resolve(
      expandHomeDirectory(
        options.activeProfileDirectory ??
          activeFromEnv ??
          DEFAULT_ACTIVE_PROFILE_DIRECTORY
      )
    );
    this.profilesRootDirectory = resolve(
      expandHomeDirectory(
        options.profilesRootDirectory ?? DEFAULT_PROFILES_ROOT_DIRECTORY
      )
    );
  }

  getManagedPaths(profileDirectoryPath: string): ProfileManagedPaths {
    return {
      profileDir: profileDirectoryPath,
      opencodePath: join(profileDirectoryPath, "opencode.json"),
      ohMyOpencodePath: join(profileDirectoryPath, "oh-my-opencode.json"),
      agentsPath: join(profileDirectoryPath, "AGENTS.md"),
      agentDirPath: join(profileDirectoryPath, "agent"),
      agentRegistryPath: join(profileDirectoryPath, "agents.registry.json")
    };
  }

  async resolveActiveProfilePath() {
    try {
      return await fs.realpath(this.activeProfileDirectory);
    } catch (error) {
      if (isErrnoError(error) && error.code === "ENOENT") {
        throw new Error(
          `Active profile directory not found: ${this.activeProfileDirectory}`,
          { cause: error }
        );
      }

      throw error;
    }
  }

  async listProfiles(): Promise<ProfileSummary[]> {
    const activePath = await this.resolveActiveProfilePath();
    const profilesByPath = new Map<string, ProfileSummary>();

    const pushProfile = async (candidatePath: string) => {
      const resolvedPath = await ignoreEnoent(
        () => fs.realpath(candidatePath),
        candidatePath
      );

      const id = basename(resolvedPath);
      profilesByPath.set(resolvedPath, {
        id,
        name: id,
        path: resolvedPath,
        isActive: resolvedPath === activePath
      });
    };

    await pushProfile(activePath);

    const entries = await ignoreEnoent(
      () =>
        fs.readdir(this.profilesRootDirectory, { withFileTypes: true }),
      [] as import("node:fs").Dirent[]
    );

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      await pushProfile(join(this.profilesRootDirectory, entry.name));
    }

    return Array.from(profilesByPath.values()).sort((left, right) => {
      if (left.isActive === right.isActive) {
        return left.name.localeCompare(right.name);
      }

      return left.isActive ? -1 : 1;
    });
  }

  async loadActiveProfile(): Promise<ActiveProfileState> {
    const profilePath = await this.resolveActiveProfilePath();
    const managedPaths = this.getManagedPaths(profilePath);

    const opencodeRaw = await fs.readFile(managedPaths.opencodePath, "utf8");
    const ohMyRaw = await readOptionalText(managedPaths.ohMyOpencodePath);
    const agentsRaw = await readOptionalText(managedPaths.agentsPath);

    const opencodeJson = parseJsonObject(managedPaths.opencodePath, opencodeRaw);
    const ohMyOpencodeJson = ohMyRaw
      ? parseJsonObject(managedPaths.ohMyOpencodePath, ohMyRaw)
      : {};
    const agentsMarkdown = agentsRaw ?? "";
    const agentPrompts = await readAgentPrompts(managedPaths.agentDirPath);

    const stat = await fs.stat(managedPaths.opencodePath);
    const profileName = basename(profilePath);

    return {
      id: profileName,
      name: profileName,
      path: profilePath,
      isActive: true,
      updatedAt: stat.mtime.toISOString(),
      opencodeJson,
      ohMyOpencodeJson,
      agentsMarkdown,
      agentPrompts
    };
  }

  async saveOpencodeJson(profilePath: string, nextConfig: JsonObject) {
    const managedPaths = this.getManagedPaths(profilePath);
    await atomicWriteText(managedPaths.opencodePath, serializeJson(nextConfig));
  }

  async saveOhMyOpencodeJson(profilePath: string, nextConfig: JsonObject) {
    const managedPaths = this.getManagedPaths(profilePath);
    await atomicWriteText(
      managedPaths.ohMyOpencodePath,
      serializeJson(nextConfig)
    );
  }

  async saveAgentsMarkdown(profilePath: string, markdown: string) {
    const managedPaths = this.getManagedPaths(profilePath);
    await atomicWriteText(managedPaths.agentsPath, markdown);
  }

  async readAgentRegistry(profilePath: string): Promise<JsonObject | null> {
    const managedPaths = this.getManagedPaths(profilePath);
    const raw = await readOptionalText(managedPaths.agentRegistryPath);

    if (!raw) {
      return null;
    }

    try {
      return parseJsonObject(managedPaths.agentRegistryPath, raw);
    } catch {
      return null;
    }
  }

  async saveAgentRegistry(profilePath: string, nextRegistry: JsonObject) {
    const managedPaths = this.getManagedPaths(profilePath);
    await atomicWriteText(
      managedPaths.agentRegistryPath,
      serializeJson(nextRegistry)
    );
  }
}
