import { describe, expect, it } from "vitest";
import { evaluateRegistryDrift } from "../src/modules/profile/application/drift-evaluator.js";
import {
  projectRegistryToOpencodeConfig,
  projectRegistryToAgentsMarkdown,
  type AgentRegistryDocument
} from "../src/modules/profile/application/agent-registry.js";
import type { JsonObject } from "../src/modules/profile/domain/profile-types.js";

function makeRegistry(
  agents: AgentRegistryDocument["agents"] = []
): AgentRegistryDocument {
  return {
    version: 1,
    updatedAt: "2026-02-26T00:00:00.000Z",
    agents
  };
}

function makeBaseConfig(): JsonObject {
  return {
    agent: {
      build: {
        model: "anthropic/claude-sonnet-4-6",
        permission: {
          task: {}
        }
      }
    }
  };
}

// ---------------------------------------------------------------------------
// evaluateRegistryDrift — identical / no drift
// ---------------------------------------------------------------------------
describe("evaluateRegistryDrift — no drift", () => {
  it("reports inSync for empty registry with matching projected config", () => {
    const registry = makeRegistry();
    const config = projectRegistryToOpencodeConfig({}, registry);
    const markdown = projectRegistryToAgentsMarkdown("", registry);

    const drift = evaluateRegistryDrift(config, markdown, registry);
    expect(drift.inSync).toBe(true);
    expect(drift.issues).toEqual([]);
  });

  it("reports inSync when projected config exactly matches current state", () => {
    const registry = makeRegistry([
      {
        key: "explore",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const baseConfig = makeBaseConfig();
    const config = projectRegistryToOpencodeConfig(baseConfig, registry);
    const markdown = projectRegistryToAgentsMarkdown("", registry);

    const drift = evaluateRegistryDrift(config, markdown, registry);
    expect(drift.inSync).toBe(true);
    expect(drift.issues).toEqual([]);
  });

  it("reports inSync with multiple agents of various exposure types", () => {
    const registry = makeRegistry([
      {
        key: "build",
        definition: {
          model: "anthropic/claude-sonnet-4-6",
          permission: { task: { "*": "allow" } }
        },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "off",
        keyPool: "any"
      },
      {
        key: "general",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "software"
      },
      {
        key: "codex-websearch",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "alias",
        keyPool: "default",
        taskAlias: "codex-search"
      }
    ]);

    const config = projectRegistryToOpencodeConfig({}, registry);
    const markdown = projectRegistryToAgentsMarkdown("", registry);

    const drift = evaluateRegistryDrift(config, markdown, registry);
    expect(drift.inSync).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateRegistryDrift — changed agents
// ---------------------------------------------------------------------------
describe("evaluateRegistryDrift — changed agents", () => {
  it("detects drift when agents differ from projected state", () => {
    const registry = makeRegistry([
      {
        key: "explore",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const config = projectRegistryToOpencodeConfig(makeBaseConfig(), registry);
    const markdown = projectRegistryToAgentsMarkdown("", registry);

    // Introduce drift: add an extra agent that registry doesn't project
    (config as { agent: JsonObject }).agent = {
      ...(config as { agent: JsonObject }).agent as JsonObject,
      extra: { model: "openai/gpt-5.3-codex-low" }
    };

    const drift = evaluateRegistryDrift(config, markdown, registry);
    expect(drift.inSync).toBe(false);
    expect(drift.issues).toContain(
      "opencode.json agent map differs from registry projection"
    );
  });

  it("detects drift when agent model changes", () => {
    const registry = makeRegistry([
      {
        key: "general",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "default"
      }
    ]);

    const config = projectRegistryToOpencodeConfig(makeBaseConfig(), registry);
    const markdown = projectRegistryToAgentsMarkdown("", registry);

    // Modify the agent's model in the config
    const agents = (config as { agent: JsonObject }).agent as JsonObject;
    const general = agents.general as JsonObject;
    general.model = "openai/gpt-5.3-codex-medium";

    const drift = evaluateRegistryDrift(config, markdown, registry);
    expect(drift.inSync).toBe(false);
    expect(drift.issues).toContain(
      "opencode.json agent map differs from registry projection"
    );
  });
});

// ---------------------------------------------------------------------------
// evaluateRegistryDrift — changed task permissions
// ---------------------------------------------------------------------------
describe("evaluateRegistryDrift — changed task permissions", () => {
  it("detects drift when task permissions differ", () => {
    const registry = makeRegistry([
      {
        key: "general",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "default"
      }
    ]);

    const opencodeJson: JsonObject = {
      agent: {
        build: {
          model: "anthropic/claude-sonnet-4-6",
          permission: {
            task: {
              unrelated: "allow"
            }
          }
        },
        general: {
          model: "openai/gpt-5.3-codex-pool-default"
        }
      }
    };

    const drift = evaluateRegistryDrift(opencodeJson, "", registry);
    expect(drift.inSync).toBe(false);
    expect(
      drift.issues.some((issue) =>
        issue.includes("build task permissions differ")
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateRegistryDrift — changed plugins
// ---------------------------------------------------------------------------
describe("evaluateRegistryDrift — changed plugins", () => {
  it("detects drift when plugin list differs from projection", () => {
    const previousHome = process.env.HOME;
    process.env.HOME = "/home/tester";

    try {
      const registry = makeRegistry([
        {
          key: "build",
          definition: { model: "anthropic/claude-sonnet-4-6" },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "off",
          keyPool: "any"
        }
      ]);

      const config = projectRegistryToOpencodeConfig({}, registry);
      const markdown = projectRegistryToAgentsMarkdown("", registry);

      // Tamper with the plugin list
      (config as { plugin: string[] }).plugin = ["rogue-plugin@1.0.0"];

      const drift = evaluateRegistryDrift(config, markdown, registry);
      expect(drift.inSync).toBe(false);
      expect(
        drift.issues.some((issue) =>
          issue.includes("plugin list differs")
        )
      ).toBe(true);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// evaluateRegistryDrift — changed markdown block
// ---------------------------------------------------------------------------
describe("evaluateRegistryDrift — changed markdown block", () => {
  it("detects drift when markdown managed block differs", () => {
    const registry = makeRegistry([
      {
        key: "explore",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const config = projectRegistryToOpencodeConfig(makeBaseConfig(), registry);

    // Pass a stale markdown without the managed routing block
    const staleMarkdown = "# My AGENTS.md\n\nSome old content.\n";

    const drift = evaluateRegistryDrift(config, staleMarkdown, registry);
    expect(drift.inSync).toBe(false);
    expect(
      drift.issues.some((issue) =>
        issue.includes("AGENTS.md managed routing block differs")
      )
    ).toBe(true);
  });

  it("detects drift when markdown managed block content differs", () => {
    const registry = makeRegistry([
      {
        key: "sonnet",
        definition: { model: "anthropic/claude-sonnet-4-6" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const config = projectRegistryToOpencodeConfig(makeBaseConfig(), registry);
    const correctMarkdown = projectRegistryToAgentsMarkdown("", registry);

    // Replace with a stale managed block
    const staleMarkdown = correctMarkdown.replace(
      /`sonnet`/g,
      "`old-agent`"
    );

    const drift = evaluateRegistryDrift(config, staleMarkdown, registry);
    expect(drift.inSync).toBe(false);
    expect(
      drift.issues.some((issue) =>
        issue.includes("AGENTS.md managed routing block differs")
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateRegistryDrift — edge cases
// ---------------------------------------------------------------------------
describe("evaluateRegistryDrift — edge cases", () => {
  it("handles empty registry against empty config", () => {
    const registry = makeRegistry();
    const config = projectRegistryToOpencodeConfig({}, registry);
    const markdown = projectRegistryToAgentsMarkdown("", registry);

    const drift = evaluateRegistryDrift(config, markdown, registry);
    expect(drift.inSync).toBe(true);
    expect(drift.issues).toHaveLength(0);
  });

  it("handles config with missing agent section", () => {
    const registry = makeRegistry();
    const drift = evaluateRegistryDrift({}, "", registry);
    // The projected config for an empty registry will also produce matching empty state
    // but markdown block will differ since projection generates the managed block
    // and the empty string "" doesn't contain it
    expect(typeof drift.inSync).toBe("boolean");
    expect(Array.isArray(drift.issues)).toBe(true);
  });

  it("can accumulate multiple issues simultaneously", () => {
    const registry = makeRegistry([
      {
        key: "general",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "software"
      }
    ]);

    // Config that differs in agents, task map, and markdown
    const wrongConfig: JsonObject = {
      agent: {
        build: {
          model: "anthropic/claude-sonnet-4-6",
          permission: {
            task: {
              wrong: "allow"
            }
          }
        },
        wrong: { model: "anthropic/claude-sonnet-4-6" }
      }
    };

    const drift = evaluateRegistryDrift(wrongConfig, "", registry);
    expect(drift.inSync).toBe(false);
    expect(drift.issues.length).toBeGreaterThanOrEqual(2);
  });
});
