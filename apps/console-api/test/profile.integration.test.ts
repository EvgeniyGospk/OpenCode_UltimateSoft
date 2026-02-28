import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";

let app: ReturnType<typeof buildServer> | undefined;
let workspaceRoot = "";
let previousOcProfile = "";
let previousSnapshotsRoot = "";

async function writeJsonFile(filePath: string, value: Record<string, unknown>) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createProfileFixture() {
  workspaceRoot = await fs.mkdtemp(join(tmpdir(), "console-api-profile-"));
  const profilePath = join(workspaceRoot, "profile");
  const snapshotsPath = join(workspaceRoot, "snapshots");

  await fs.mkdir(profilePath, { recursive: true });
  await fs.mkdir(join(profilePath, "agent"), { recursive: true });
  await fs.mkdir(snapshotsPath, { recursive: true });

  await writeJsonFile(join(profilePath, "opencode.json"), {
    model: "anthropic/claude-sonnet-4-6",
    agent: {
      build: {
        model: "anthropic/claude-sonnet-4-6"
      }
    },
    provider: {
      openai: {
        options: {
          store: false
        }
      }
    }
  });
  await writeJsonFile(join(profilePath, "oh-my-opencode.json"), {
    agents: {}
  });
  await fs.writeFile(join(profilePath, "AGENTS.md"), "Initial profile\n", "utf8");
  await fs.writeFile(
    join(profilePath, "agent", "designer.md"),
    "Designer prompt\n",
    "utf8"
  );

  process.env.OC_PROFILE = profilePath;
  process.env.OC_SNAPSHOTS_ROOT = snapshotsPath;
}

beforeEach(async () => {
  previousOcProfile = process.env.OC_PROFILE ?? "";
  previousSnapshotsRoot = process.env.OC_SNAPSHOTS_ROOT ?? "";
  await createProfileFixture();
});

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }

  if (previousOcProfile) {
    process.env.OC_PROFILE = previousOcProfile;
  } else {
    delete process.env.OC_PROFILE;
  }

  if (previousSnapshotsRoot) {
    process.env.OC_SNAPSHOTS_ROOT = previousSnapshotsRoot;
  } else {
    delete process.env.OC_SNAPSHOTS_ROOT;
  }

  if (workspaceRoot) {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    workspaceRoot = "";
  }
});

describe("profile routes", () => {
  it("supports active profile read and agents/providers mutation with snapshots", async () => {
    app = buildServer({ logger: false, jobsDbPath: ":memory:" });

    const activeProfileResponse = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/active"
    });
    expect(activeProfileResponse.statusCode).toBe(200);

    const registryPath = join(workspaceRoot, "profile", "agents.registry.json");
    await expect(fs.access(registryPath)).resolves.toBeUndefined();

    const syncStatusResponse = await app.inject({
      method: "GET",
      url: "/api/v1/agents/sync-status"
    });
    expect(syncStatusResponse.statusCode).toBe(200);
    const syncStatusPayload = syncStatusResponse.json<{
      data: {
        inSync: boolean;
        registryExists: boolean;
        issues: string[];
      };
    }>();
    expect(syncStatusPayload.data.registryExists).toBe(true);
    expect(syncStatusPayload.data.inSync).toBe(true);
    expect(syncStatusPayload.data.issues).toEqual([]);

    const createAgentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "planner",
        definition: {
          model: "openai/gpt-5.3-codex-medium"
        },
        keyPool: "software"
      }
    });
    expect(createAgentResponse.statusCode).toBe(201);

    const updateProviderResponse = await app.inject({
      method: "PUT",
      url: "/api/v1/providers/openai",
      payload: {
        definition: {
          options: {
            store: true
          }
        }
      }
    });
    expect(updateProviderResponse.statusCode).toBe(200);

    const listAgentsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/agents"
    });
    expect(listAgentsResponse.statusCode).toBe(200);

    const listAgentsPayload = listAgentsResponse.json<{
      data: {
        items: Array<{
          key: string;
          definition: { model?: string };
          keyPool?: string;
          taskExposure?: string;
        }>;
      };
    }>();

    expect(listAgentsPayload.data.items.some((item) => item.key === "planner")).toBe(
      true
    );
    expect(
      listAgentsPayload.data.items.find((item) => item.key === "planner")?.keyPool
    ).toBe("software");
    expect(
      listAgentsPayload.data.items.find((item) => item.key === "planner")
        ?.taskExposure
    ).toBe("direct");

    const opencodeAfterCreate = await fs.readFile(
      join(workspaceRoot, "profile", "opencode.json"),
      "utf8"
    );
    const opencodeAfterCreateJson = JSON.parse(opencodeAfterCreate) as {
      agent?: Record<
        string,
        {
          model?: string;
          permission?: {
            task?: Record<string, string>;
          };
        }
      >;
      plugin?: string[];
    };
    expect(opencodeAfterCreateJson.agent?.planner?.model).toBe(
      "openai/gpt-5.3-codex"
    );
    expect(opencodeAfterCreateJson.agent?.build?.permission?.task?.planner).toBe(
      "allow"
    );
    expect(opencodeAfterCreateJson.plugin).toEqual([
      "opencode-antigravity-auth@1.6.0",
      "@guard22/opencode-multi-auth-codex",
      `file://${process.env.HOME}/.config/opencode/local-plugins/opencode-morph-fast-apply/index.ts`
    ]);

    const registryAfterCreate = JSON.parse(
      await fs.readFile(join(workspaceRoot, "profile", "agents.registry.json"), "utf8")
    ) as {
      agents?: Array<{
        key: string;
        taskExposure?: string;
        definition?: { model?: string };
      }>;
    };
    const plannerEntry = registryAfterCreate.agents?.find(
      (entry) => entry.key === "planner"
    );
    expect(plannerEntry?.taskExposure).toBe("direct");
    expect(plannerEntry?.definition?.model).toBe("openai/gpt-5.3-codex");

    const updateAgentResponse = await app.inject({
      method: "PUT",
      url: "/api/v1/agents/planner",
      payload: {
        definition: {
          model: "openai/gpt-5.3-codex-high"
        },
        keyPool: "default"
      }
    });
    expect(updateAgentResponse.statusCode).toBe(200);

    const opencodeAfterUpdate = await fs.readFile(
      join(workspaceRoot, "profile", "opencode.json"),
      "utf8"
    );
    const opencodeAfterUpdateJson = JSON.parse(opencodeAfterUpdate) as {
      agent?: Record<string, { model?: string }>;
    };
    expect(opencodeAfterUpdateJson.agent?.planner?.model).toBe(
      "openai/gpt-5.3-codex"
    );

    const renameAgentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/agents/planner/rename",
      payload: {
        key: "planner-v2"
      }
    });
    expect(renameAgentResponse.statusCode).toBe(200);

    const listRenamedAgentsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/agents"
    });
    const listRenamedAgentsPayload = listRenamedAgentsResponse.json<{
      data: { items: Array<{ key: string; definition: { model?: string } }> };
    }>();
    expect(
      listRenamedAgentsPayload.data.items.some((item) => item.key === "planner-v2")
    ).toBe(true);

    const backupsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/backups"
    });
    expect(backupsResponse.statusCode).toBe(200);

    const backupsPayload = backupsResponse.json<{
      data: { items: Array<{ id: string }> };
    }>();
    expect(backupsPayload.data.items.length).toBeGreaterThanOrEqual(2);

    const manualSyncResponse = await app.inject({
      method: "POST",
      url: "/api/v1/agents/sync"
    });
    expect(manualSyncResponse.statusCode).toBe(200);
  });

  it("restores older snapshot state", async () => {
    app = buildServer({ logger: false, jobsDbPath: ":memory:" });

    const baselineUpdate = await app.inject({
      method: "PUT",
      url: "/api/v1/agents/build",
      payload: {
        definition: {
          model: "anthropic/claude-sonnet-4-6"
        }
      }
    });
    expect(baselineUpdate.statusCode).toBe(200);

    const changedUpdate = await app.inject({
      method: "PUT",
      url: "/api/v1/agents/build",
      payload: {
        definition: {
          model: "openai/gpt-5.3-codex"
        }
      }
    });
    expect(changedUpdate.statusCode).toBe(200);

    const backupsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/backups"
    });
    const backupsPayload = backupsResponse.json<{
      data: {
        items: Array<{ id: string; createdAt: string }>;
      };
    }>();

    expect(backupsPayload.data.items.length).toBeGreaterThanOrEqual(2);
    const snapshotToRestore = backupsPayload.data.items.at(-1);
    expect(snapshotToRestore).toBeDefined();

    const restoreResponse = await app.inject({
      method: "POST",
      url: `/api/v1/backups/restore/${snapshotToRestore?.id}`
    });
    expect(restoreResponse.statusCode).toBe(200);

    const activeProfileResponse = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/active"
    });
    const activePayload = activeProfileResponse.json<{
      data: {
        opencodeJson: {
          agent?: Record<string, { model?: string }>;
        };
      };
    }>();

    const restoredModel = activePayload.data.opencodeJson.agent?.build?.model;
    expect(restoredModel).toBe("anthropic/claude-sonnet-4-6");
  });
});
