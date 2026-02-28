import { describe, expect, it } from "vitest";
import {
  buildRegistryFromOpencodeConfig,
  evaluateRegistryDrift,
  projectRegistryToAgentsMarkdown,
  projectRegistryToOpencodeConfig,
  resolveAgentRegistry,
  type AgentRegistryDocument
} from "../src/modules/profile/application/agent-registry.js";
import type { JsonObject } from "../src/modules/profile/domain/profile-types.js";

describe("agent registry key pools", () => {
  it("infers keyPool from projected model suffix and stores clean model", () => {
    const opencodeJson: JsonObject = {
      agent: {
        search: {
          model: "openai/gpt-5.3-codex-pool-soft"
        },
        "web-low": {
          model: "openai/gpt-5.3-codex-low-pool-default"
        },
        sonnet: {
          model: "anthropic/claude-sonnet-4-6"
        }
      }
    };

    const registry = buildRegistryFromOpencodeConfig(
      opencodeJson,
      "2026-02-26T00:00:00.000Z"
    );
    const search = registry.agents.find((agent) => agent.key === "search");
    const webLow = registry.agents.find((agent) => agent.key === "web-low");
    const sonnet = registry.agents.find((agent) => agent.key === "sonnet");

    expect(search?.definition.model).toBe("openai/gpt-5.3-codex");
    expect(search?.keyPool).toBe("software");

    expect(webLow?.definition.model).toBe("openai/gpt-5.3-codex-low");
    expect(webLow?.keyPool).toBe("default");

    expect(sonnet?.definition.model).toBe("anthropic/claude-sonnet-4-6");
    expect(sonnet?.keyPool).toBe("any");
  });

  it("projects keyPool suffix only for non-task codex agents", () => {
    const registry: AgentRegistryDocument = {
      version: 1,
      updatedAt: "2026-02-26T00:00:00.000Z",
      agents: [
        {
          key: "software-codex",
          definition: {
            model: "openai/gpt-5.3-codex"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "off",
          keyPool: "software"
        },
        {
          key: "default-codex",
          definition: {
            model: "openai/gpt-5.3-codex-low"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "off",
          keyPool: "default"
        },
        {
          key: "direct-codex",
          definition: {
            model: "openai/gpt-5.3-codex"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "direct",
          keyPool: "software"
        },
        {
          key: "alias-codex",
          definition: {
            model: "openai/gpt-5.3-codex-low"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "alias",
          keyPool: "default",
          taskAlias: "codex-search"
        },
        {
          key: "any-codex",
          definition: {
            model: "openai/gpt-5.3-codex-high"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "off",
          keyPool: "any"
        },
        {
          key: "non-openai",
          definition: {
            model: "anthropic/claude-sonnet-4-6"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "off",
          keyPool: "software"
        }
      ]
    };

    const projected = projectRegistryToOpencodeConfig(
      {
        agent: {
          build: {
            model: "anthropic/claude-sonnet-4-6",
            permission: {
              task: {}
            }
          }
        }
      },
      registry
    ) as {
      agent?: Record<string, { model?: string }>;
    };

    expect(projected.agent?.["software-codex"]?.model).toBe(
      "openai/gpt-5.3-codex-pool-soft"
    );
    expect(projected.agent?.["default-codex"]?.model).toBe(
      "openai/gpt-5.3-codex-low-pool-default"
    );
    expect(projected.agent?.["direct-codex"]?.model).toBe("openai/gpt-5.3-codex");
    expect(projected.agent?.["alias-codex"]?.model).toBe("openai/gpt-5.3-codex");
    expect(projected.agent?.["any-codex"]?.model).toBe("openai/gpt-5.3-codex-high");
    expect(projected.agent?.["non-openai"]?.model).toBe(
      "anthropic/claude-sonnet-4-6"
    );
  });

  it("normalizes raw registry entries and keeps drift check clean after projection", () => {
    const rawRegistry: JsonObject = {
      version: 1,
      updatedAt: "2026-02-26T00:00:00.000Z",
      agents: [
        {
          key: "codex-websearch",
          definition: {
            model: "openai/gpt-5.3-codex-low-pool-soft"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "alias",
          taskAlias: "codex-search"
        }
      ]
    };
    const baseOpencode: JsonObject = {
      agent: {
        build: {
          model: "anthropic/claude-sonnet-4-6",
          permission: {
            task: {}
          }
        }
      }
    };

    const resolved = resolveAgentRegistry(rawRegistry, baseOpencode);
    expect(resolved.source).toBe("file");
    expect(resolved.registry.agents[0]?.definition.model).toBe("openai/gpt-5.3-codex");
    expect(resolved.registry.agents[0]?.keyPool).toBe("software");

    const projectedConfig = projectRegistryToOpencodeConfig(baseOpencode, resolved.registry);
    const projectedMarkdown = projectRegistryToAgentsMarkdown("", resolved.registry);
    const drift = evaluateRegistryDrift(
      projectedConfig,
      projectedMarkdown,
      resolved.registry
    );
    expect(drift.inSync).toBe(true);
    expect(drift.issues).toEqual([]);
  });

  it("drops taskAlias for direct agents while preserving it for alias agents", () => {
    const rawRegistry: JsonObject = {
      version: 1,
      updatedAt: "2026-02-26T00:00:00.000Z",
      agents: [
        {
          key: "direct-with-alias",
          definition: {
            model: "openai/gpt-5.3-codex"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "direct",
          taskAlias: "legacy-alias",
          keyPool: "software"
        },
        {
          key: "alias-agent",
          definition: {
            model: "openai/gpt-5.3-codex"
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "alias",
          taskAlias: "codex-search",
          keyPool: "default"
        }
      ]
    };

    const resolved = resolveAgentRegistry(rawRegistry, {});
    const directAgent = resolved.registry.agents.find(
      (entry) => entry.key === "direct-with-alias"
    );
    const aliasAgent = resolved.registry.agents.find(
      (entry) => entry.key === "alias-agent"
    );

    expect(directAgent?.taskExposure).toBe("direct");
    expect(directAgent?.taskAlias).toBeUndefined();
    expect(aliasAgent?.taskExposure).toBe("alias");
    expect(aliasAgent?.taskAlias).toBe("codex-search");
  });

  it("normalizes task-exposed codex reasoning variants to base model id", () => {
    const registry: AgentRegistryDocument = {
      version: 1,
      updatedAt: "2026-02-26T00:00:00.000Z",
      agents: [
        {
          key: "direct-medium",
          definition: { model: "openai/gpt-5.3-codex-medium" },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "direct",
          keyPool: "software"
        },
        {
          key: "alias-high",
          definition: { model: "openai/gpt-5.3-codex-high" },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "alias",
          keyPool: "default",
          taskAlias: "codex-search"
        }
      ]
    };

    const projected = projectRegistryToOpencodeConfig({}, registry) as {
      agent?: Record<string, { model?: string }>;
    };

    expect(projected.agent?.["direct-medium"]?.model).toBe("openai/gpt-5.3-codex");
    expect(projected.agent?.["alias-high"]?.model).toBe("openai/gpt-5.3-codex");
  });

  it("preserves wildcard build task permission and includes alias target in projection", () => {
    const registry: AgentRegistryDocument = {
      version: 1,
      updatedAt: "2026-02-26T00:00:00.000Z",
      agents: [
        {
          key: "build",
          definition: {
            model: "anthropic/claude-sonnet-4-6",
            permission: {
              task: {
                "*": "allow"
              }
            }
          },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "off",
          keyPool: "any"
        },
        {
          key: "explore",
          definition: { model: "openai/gpt-5.3-codex" },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "direct",
          keyPool: "any"
        },
        {
          key: "codex-websearch",
          definition: { model: "openai/gpt-5.3-codex-low" },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "alias",
          keyPool: "software",
          taskAlias: "codex-search"
        }
      ]
    };
    const projected = projectRegistryToOpencodeConfig({}, registry) as {
      agent?: Record<string, unknown>;
    };

    const buildTask = (projected.agent?.build as { permission?: { task?: Record<string, string> } })
      ?.permission?.task;
    expect(buildTask?.["*"]).toBe("allow");
    expect(buildTask?.explore).toBe("allow");
    expect(buildTask?.["codex-websearch"]).toBe("allow");
    expect(buildTask?.["codex-search"]).toBe("allow");
  });

  it("reports drift when task map differs from projected state", () => {
    const registry: AgentRegistryDocument = {
      version: 1,
      updatedAt: "2026-02-26T00:00:00.000Z",
      agents: [
        {
          key: "general",
          definition: { model: "openai/gpt-5.3-codex" },
          createdAt: "2026-02-26T00:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
          taskExposure: "direct",
          keyPool: "default"
        }
      ]
    };

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
        issue.includes("build task permissions differ from registry projection")
      )
    ).toBe(true);
  });

  it("injects required plugins, rewrites legacy paths, and preserves extra plugins", () => {
    const previousHome = process.env.HOME;
    process.env.HOME = "/home/tester";

    try {
      const registry: AgentRegistryDocument = {
        version: 1,
        updatedAt: "2026-02-26T00:00:00.000Z",
        agents: [
          {
            key: "build",
            definition: { model: "anthropic/claude-sonnet-4-6" },
            createdAt: "2026-02-26T00:00:00.000Z",
            updatedAt: "2026-02-26T00:00:00.000Z",
            taskExposure: "off",
            keyPool: "any"
          }
        ]
      };
      const opencodeJson: JsonObject = {
        plugin: [
          "opencode-antigravity-auth",
          "file:///Users/guard2/.config/opencode/local-plugins/opencode-multi-auth-codex/index.ts",
          "file:///Users/guard2/.config/opencode/local-plugins/opencode-morph-fast-apply/index.ts",
          "custom-plugin@2.0.0"
        ],
        provider: {
          custom: {
            options: {
              scriptPath:
                "/Users/guard2/.config/opencode/local-plugins/custom/index.ts"
            }
          }
        }
      };

      const projected = projectRegistryToOpencodeConfig(opencodeJson, registry) as {
        plugin?: string[];
        provider?: {
          custom?: {
            options?: {
              scriptPath?: string;
            };
          };
        };
      };

      expect(projected.plugin).toEqual([
        "opencode-antigravity-auth@1.6.0",
        "@guard22/opencode-multi-auth-codex",
        "file:///home/tester/.config/opencode/local-plugins/opencode-morph-fast-apply/index.ts",
        "custom-plugin@2.0.0"
      ]);
      expect(projected.provider?.custom?.options?.scriptPath).toBe(
        "/home/tester/.config/opencode/local-plugins/custom/index.ts"
      );
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });

  it("reports drift when plugin list differs from required projection", () => {
    const previousHome = process.env.HOME;
    process.env.HOME = "/home/tester";

    try {
      const registry: AgentRegistryDocument = {
        version: 1,
        updatedAt: "2026-02-26T00:00:00.000Z",
        agents: [
          {
            key: "build",
            definition: { model: "anthropic/claude-sonnet-4-6" },
            createdAt: "2026-02-26T00:00:00.000Z",
            updatedAt: "2026-02-26T00:00:00.000Z",
            taskExposure: "off",
            keyPool: "any"
          }
        ]
      };
      const projectedConfig = projectRegistryToOpencodeConfig({}, registry) as JsonObject;
      const projectedMarkdown = projectRegistryToAgentsMarkdown("", registry);
      projectedConfig.plugin = ["custom-plugin@2.0.0"];

      const drift = evaluateRegistryDrift(
        projectedConfig,
        projectedMarkdown,
        registry
      );
      expect(drift.inSync).toBe(false);
      expect(
        drift.issues.some((issue) =>
          issue.includes("opencode.json plugin list differs from registry projection")
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

  it("supports legacy pool suffixes and preserves non-openai models as any pool", () => {
    const opencodeJson: JsonObject = {
      agent: {
        legacySoft: {
          model: "openai/gpt-5.3-codex-soft"
        },
        legacyDefault: {
          model: "openai/gpt-5.3-codex-low-default"
        },
        noProviderModel: {
          model: "gpt-5.3-codex"
        }
      }
    };

    const registry = buildRegistryFromOpencodeConfig(
      opencodeJson,
      "2026-02-26T00:00:00.000Z"
    );
    expect(registry.agents.find((entry) => entry.key === "legacySoft")?.keyPool).toBe(
      "software"
    );
    expect(
      registry.agents.find((entry) => entry.key === "legacyDefault")?.keyPool
    ).toBe("default");
    expect(
      registry.agents.find((entry) => entry.key === "noProviderModel")?.keyPool
    ).toBe("any");
  });

  it("falls back to bootstrap for malformed registry and filters invalid raw entries", () => {
    const opencodeJson: JsonObject = {
      agent: {
        build: {
          model: "anthropic/claude-sonnet-4-6",
          permission: {
            task: {
              "*": "allow",
              custom: "allow",
              denied: "deny"
            }
          }
        },
        custom: {
          model: "openai/gpt-5.3-codex"
        }
      }
    };

    const malformed = resolveAgentRegistry(
      {
        version: 1,
        agents: "broken"
      } as unknown as JsonObject,
      opencodeJson,
      "2026-02-26T00:00:00.000Z"
    );
    expect(malformed.source).toBe("bootstrap");

    const filtered = resolveAgentRegistry(
      {
        version: 1,
        updatedAt: "not-a-date",
        agents: [
          "bad",
          {
            key: 12,
            definition: {}
          },
          {
            key: "bad key!",
            definition: {}
          },
          {
            key: "missing-definition",
            definition: "nope"
          },
          {
            key: "valid",
            definition: {
              model: "openai/gpt-5.3-codex-pool-soft"
            },
            createdAt: 0,
            updatedAt: "invalid-date",
            taskExposure: "unexpected",
            keyPool: "unknown"
          },
          {
            key: "valid",
            definition: {
              model: "openai/gpt-5.3-codex"
            },
            createdAt: "2026-02-26T00:00:00.000Z",
            updatedAt: "2026-02-26T00:00:00.000Z",
            taskExposure: "direct",
            keyPool: "default"
          }
        ]
      } as JsonObject,
      opencodeJson,
      "2026-02-26T00:00:00.000Z"
    );

    expect(filtered.source).toBe("file");
    expect(filtered.registry.agents).toHaveLength(1);
    expect(filtered.registry.agents[0]?.key).toBe("valid");
    expect(filtered.registry.agents[0]?.definition.model).toBe("openai/gpt-5.3-codex");
    expect(filtered.registry.agents[0]?.taskExposure).toBe("off");
    expect(filtered.registry.agents[0]?.keyPool).toBe("software");
    expect(filtered.registry.updatedAt).toBe("2026-02-26T00:00:00.000Z");
  });
});
