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
  workspaceRoot = await fs.mkdtemp(join(tmpdir(), "console-api-validation-"));
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
    }
  });
  await writeJsonFile(join(profilePath, "oh-my-opencode.json"), {
    agents: {}
  });
  await fs.writeFile(
    join(profilePath, "AGENTS.md"),
    "Test agents\n",
    "utf8"
  );

  process.env.OC_PROFILE = profilePath;
  process.env.OC_SNAPSHOTS_ROOT = snapshotsPath;
}

beforeEach(async () => {
  previousOcProfile = process.env.OC_PROFILE ?? "";
  previousSnapshotsRoot = process.env.OC_SNAPSHOTS_ROOT ?? "";
  await createProfileFixture();
  app = buildServer({ logger: false });
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

// ---------------------------------------------------------------------------
// Agent route validation
// ---------------------------------------------------------------------------

describe("POST /api/v1/agents — validation errors", () => {
  it("rejects a non-object request body", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: "this is a string"
    });

    // Fastify may reject before our handler; accept 400 or 415
    expect([400, 415]).toContain(response.statusCode);
  });

  it("rejects when 'key' field is missing", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        definition: { model: "test" }
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/key/i);
  });

  it("rejects when 'key' field is not a string", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: 12345,
        definition: { model: "test" }
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
  });

  it("rejects when 'definition' field is missing", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "test-agent"
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/definition/i);
  });

  it("rejects when 'definition' is not a JSON object", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "test-agent",
        definition: "not-an-object"
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
  });

  it("rejects when 'keyPool' is an invalid value", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "test-agent",
        definition: { model: "test" },
        keyPool: "invalid-pool"
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/keyPool/);
  });

  it("rejects an agent key with special characters", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "invalid key with spaces!",
        definition: { model: "test" }
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("INVALID_KEY");
  });

  it("returns 409 when creating a duplicate agent", async () => {
    // Create the first agent
    const firstResponse = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "duplicate-agent",
        definition: { model: "test" }
      }
    });
    expect(firstResponse.statusCode).toBe(201);

    // Try to create it again
    const secondResponse = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "duplicate-agent",
        definition: { model: "test2" }
      }
    });
    expect(secondResponse.statusCode).toBe(409);
    const body = secondResponse.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("AGENT_EXISTS");
  });
});

describe("PUT /api/v1/agents/:agentKey — validation errors", () => {
  it("rejects when body is not a JSON object", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/agents/build",
      payload: "just a string"
    });

    expect([400, 415]).toContain(response.statusCode);
  });

  it("rejects when 'definition' is missing from update body", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/agents/build",
      payload: {
        keyPool: "any"
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/definition/i);
  });

  it("rejects when 'definition' is a string instead of object", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/agents/build",
      payload: {
        definition: "not-an-object"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns 404 when updating a nonexistent agent", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/agents/nonexistent-agent",
      payload: {
        definition: { model: "test" }
      }
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("AGENT_NOT_FOUND");
  });

  it("rejects an invalid keyPool in update", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/agents/build",
      payload: {
        definition: { model: "test" },
        keyPool: "bogus"
      }
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /api/v1/agents/:agentKey/rename — validation errors", () => {
  it("rejects when body is missing 'key'", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents/build/rename",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/key/i);
  });

  it("rejects when 'key' is not a string", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents/build/rename",
      payload: { key: 42 }
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects renaming a nonexistent agent", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents/ghost-agent/rename",
      payload: { key: "new-name" }
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("AGENT_NOT_FOUND");
  });

  it("rejects renaming to the same key", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents/build/rename",
      payload: { key: "build" }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("AGENT_RENAME_NOOP");
  });

  it("rejects renaming to an existing agent key", async () => {
    // First create a second agent
    await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      payload: {
        key: "target-agent",
        definition: { model: "test" }
      }
    });

    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents/build/rename",
      payload: { key: "target-agent" }
    });

    expect(response.statusCode).toBe(409);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("AGENT_EXISTS");
  });

  it("rejects renaming to a key with invalid characters", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/agents/build/rename",
      payload: { key: "invalid name!" }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("INVALID_KEY");
  });
});

describe("DELETE /api/v1/agents/:agentKey — validation errors", () => {
  it("returns 404 when deleting a nonexistent agent", async () => {
    const response = await app!.inject({
      method: "DELETE",
      url: "/api/v1/agents/nonexistent-agent"
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("AGENT_NOT_FOUND");
  });

  it("rejects deletion of an agent with invalid key characters", async () => {
    const response = await app!.inject({
      method: "DELETE",
      url: "/api/v1/agents/bad%20key!"
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("INVALID_KEY");
  });
});

// ---------------------------------------------------------------------------
// Provider route validation
// ---------------------------------------------------------------------------

describe("PUT /api/v1/providers/:providerKey — validation errors", () => {
  it("rejects when body is not a JSON object", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/providers/openai",
      payload: "not json"
    });

    expect([400, 415]).toContain(response.statusCode);
  });

  it("rejects when 'definition' is missing", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/providers/openai",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/definition/i);
  });

  it("rejects when 'definition' is an array instead of object", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/providers/openai",
      payload: {
        definition: [1, 2, 3]
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects an invalid provider key with special characters", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/providers/bad%20key!",
      payload: {
        definition: { store: true }
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("INVALID_KEY");
  });
});

// ---------------------------------------------------------------------------
// Profile route validation
// ---------------------------------------------------------------------------

describe("PUT /api/v1/profiles/active — validation errors", () => {
  it("rejects an empty update with no fields", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/profiles/active",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("EMPTY_UPDATE");
    expect(body.error.message).toMatch(/at least one field/i);
  });

  it("rejects when opencodeJson is not a JSON object", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/profiles/active",
      payload: {
        opencodeJson: "not-an-object"
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/opencodeJson/i);
  });

  it("rejects when ohMyOpencodeJson is not a JSON object", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/profiles/active",
      payload: {
        ohMyOpencodeJson: [1, 2]
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/ohMyOpencodeJson/i);
  });

  it("rejects when agentsMarkdown is not a string", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/profiles/active",
      payload: {
        agentsMarkdown: 42
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("INVALID_BODY");
    expect(body.error.message).toMatch(/agentsMarkdown/i);
  });

  it("rejects when body is not a JSON object at all", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/profiles/active",
      payload: "just a string"
    });

    expect([400, 415]).toContain(response.statusCode);
  });

  it("accepts a valid partial update with only opencodeJson", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/profiles/active",
      payload: {
        opencodeJson: { model: "new-model" }
      }
    });

    expect(response.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Backup route validation
// ---------------------------------------------------------------------------

describe("POST /api/v1/backups/restore/:snapshotId — validation errors", () => {
  it("returns 404 for a nonexistent snapshot id", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/v1/backups/restore/nonexistent-snapshot-id"
    });

    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("SNAPSHOT_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// Envelope format verification
// ---------------------------------------------------------------------------

describe("API envelope format", () => {
  it("returns proper envelope structure with requestId and traceId on success", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/v1/profiles/active",
      headers: {
        "x-request-id": "test-req-123",
        "x-trace-id": "test-trace-456"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      requestId: string;
      traceId: string;
      data: unknown;
      error: null;
    }>();

    expect(body.requestId).toBe("test-req-123");
    expect(body.traceId).toBe("test-trace-456");
    expect(body.data).toBeDefined();
    expect(body.error).toBeNull();
  });

  it("returns proper envelope structure with error on failure", async () => {
    const response = await app!.inject({
      method: "PUT",
      url: "/api/v1/profiles/active",
      headers: {
        "x-request-id": "err-req-123",
        "x-trace-id": "err-trace-456"
      },
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<{
      requestId: string;
      traceId: string;
      data: null;
      error: { code: string; message: string };
    }>();

    expect(body.requestId).toBe("err-req-123");
    expect(body.traceId).toBe("err-trace-456");
    expect(body.data).toBeNull();
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
  });

  it("generates requestId and traceId when headers are absent", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    const body = response.json<{
      requestId: string;
      traceId: string;
    }>();

    // Should be UUID format
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(body.requestId).toMatch(uuidPattern);
    expect(body.traceId).toMatch(uuidPattern);
  });
});

// ---------------------------------------------------------------------------
// Unknown route
// ---------------------------------------------------------------------------

describe("unknown routes", () => {
  it("returns 404 for an unregistered path", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/v1/does-not-exist"
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 for wrong HTTP method on existing path", async () => {
    const response = await app!.inject({
      method: "PATCH",
      url: "/api/v1/agents"
    });

    // Fastify returns 404 for unregistered method+path combinations
    expect([404, 405]).toContain(response.statusCode);
  });
});
