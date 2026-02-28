import { describe, expect, it } from "vitest";
import {
  projectRegistryToAgentsMarkdown,
  readManagedBlock
} from "../src/modules/profile/application/markdown-renderer.js";
import type { AgentRegistryDocument } from "../src/modules/profile/application/agent-registry.js";

const BLOCK_START = "<!-- OPENCODE_CONSOLE_MANAGED_ROUTING:START -->";
const BLOCK_END = "<!-- OPENCODE_CONSOLE_MANAGED_ROUTING:END -->";

function makeRegistry(
  agents: AgentRegistryDocument["agents"] = []
): AgentRegistryDocument {
  return {
    version: 1,
    updatedAt: "2026-02-28T00:00:00.000Z",
    agents
  };
}

describe("renderManagedRoutingBlock (via projectRegistryToAgentsMarkdown)", () => {
  it("renders correct header and sentinel comments", () => {
    const result = projectRegistryToAgentsMarkdown("", makeRegistry());

    expect(result).toContain(BLOCK_START);
    expect(result).toContain(BLOCK_END);
    expect(result).toContain("## OpenCode Console Managed Routing");
    expect(result).toContain("auto-generated from `agents.registry.json`");
  });

  it("renders direct agents under Task-exposed Agents section", () => {
    const registry = makeRegistry([
      {
        key: "explore",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown("", registry);

    expect(result).toContain("### Task-exposed Agents (direct)");
    expect(result).toContain("- `explore` (`openai/gpt-5.3-codex`)");
  });

  it("renders alias agents under Task Aliases section", () => {
    const registry = makeRegistry([
      {
        key: "codex-websearch",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "alias",
        keyPool: "any",
        taskAlias: "codex-search"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown("", registry);

    expect(result).toContain("### Task Aliases");
    expect(result).toContain(
      "- `codex-websearch` -> `codex-search` (`openai/gpt-5.3-codex`)"
    );
  });

  it("renders '- _none_' when no direct agents exist", () => {
    const registry = makeRegistry([
      {
        key: "build",
        definition: { model: "anthropic/claude-sonnet-4-6" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "off",
        keyPool: "any"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown("", registry);
    const directSection = result.split("### Task-exposed Agents (direct)")[1]?.split("###")[0];

    expect(directSection).toContain("- _none_");
  });

  it("renders '- _none_' when no alias agents exist", () => {
    const registry = makeRegistry([
      {
        key: "explore",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown("", registry);
    const aliasSection = result.split("### Task Aliases")[1]?.split("###")[0];

    expect(aliasSection).toContain("- _none_");
  });

  it("lists all agents in Registry Agents section with full metadata", () => {
    const registry = makeRegistry([
      {
        key: "explore",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      },
      {
        key: "build",
        definition: { model: "anthropic/claude-sonnet-4-6" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "off",
        keyPool: "software"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown("", registry);

    expect(result).toContain(
      "- `explore` (`openai/gpt-5.3-codex`, task: `direct`, pool: `any`)"
    );
    expect(result).toContain(
      "- `build` (`anthropic/claude-sonnet-4-6`, task: `off`, pool: `software`)"
    );
  });

  it("handles alias agent with missing taskAlias", () => {
    const registry = makeRegistry([
      {
        key: "some-alias",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "alias",
        keyPool: "any"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown("", registry);

    expect(result).toContain("- `some-alias` -> _missing alias_");
  });

  it("uses 'unknown-model' when definition has no model field", () => {
    const registry = makeRegistry([
      {
        key: "no-model",
        definition: {},
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown("", registry);

    expect(result).toContain("`unknown-model`");
  });
});

describe("upsertManagedBlock (via projectRegistryToAgentsMarkdown)", () => {
  it("inserts block into empty markdown", () => {
    const result = projectRegistryToAgentsMarkdown("", makeRegistry());

    expect(result).toContain(BLOCK_START);
    expect(result).toContain(BLOCK_END);
    expect(result.endsWith("\n")).toBe(true);
  });

  it("appends block to existing markdown without a managed block", () => {
    const existing = "# My Config\n\nSome instructions here.";
    const result = projectRegistryToAgentsMarkdown(existing, makeRegistry());

    expect(result).toContain("# My Config");
    expect(result).toContain("Some instructions here.");
    expect(result).toContain(BLOCK_START);
    expect(result.indexOf("Some instructions here.")).toBeLessThan(
      result.indexOf(BLOCK_START)
    );
  });

  it("replaces existing managed block in-place", () => {
    const existingBlock = [
      BLOCK_START,
      "## Old content",
      BLOCK_END
    ].join("\n");
    const existing = `# Header\n\n${existingBlock}\n\n# Footer`;

    const registry = makeRegistry([
      {
        key: "new-agent",
        definition: { model: "openai/gpt-5.3-codex" },
        createdAt: "2026-02-28T00:00:00.000Z",
        updatedAt: "2026-02-28T00:00:00.000Z",
        taskExposure: "direct",
        keyPool: "any"
      }
    ]);

    const result = projectRegistryToAgentsMarkdown(existing, registry);

    expect(result).toContain("# Header");
    expect(result).toContain("# Footer");
    expect(result).not.toContain("## Old content");
    expect(result).toContain("new-agent");

    const startCount = result.split(BLOCK_START).length - 1;
    expect(startCount).toBe(1);
  });

  it("preserves content before and after replaced block", () => {
    const before = "# Title\n\nIntro text.\n\n";
    const after = "\n\n# Conclusion\n\nEnd.";
    const oldBlock = `${BLOCK_START}\nOld stuff\n${BLOCK_END}\n`;
    const existing = `${before}${oldBlock}${after}`;

    const result = projectRegistryToAgentsMarkdown(existing, makeRegistry());

    expect(result).toContain("# Title");
    expect(result).toContain("Intro text.");
    expect(result).toContain("# Conclusion");
    expect(result).toContain("End.");
  });
});

describe("readManagedBlock", () => {
  it("extracts the managed block from markdown", () => {
    const block = `${BLOCK_START}\n## Routing\n- agent1\n${BLOCK_END}`;
    const markdown = `# Header\n\n${block}\n\n# Footer`;

    const result = readManagedBlock(markdown);

    expect(result).toContain(BLOCK_START);
    expect(result).toContain(BLOCK_END);
    expect(result).toContain("## Routing");
    expect(result).toContain("- agent1");
  });

  it("returns empty string when no managed block exists", () => {
    const result = readManagedBlock("# Just a heading\n\nNo managed block.");

    expect(result).toBe("");
  });

  it("returns empty string for empty markdown", () => {
    expect(readManagedBlock("")).toBe("");
  });

  it("extracts block even when surrounded by other content", () => {
    const markdown = [
      "# Before",
      "",
      "Some text",
      "",
      BLOCK_START,
      "## Inside",
      BLOCK_END,
      "",
      "# After"
    ].join("\n");

    const result = readManagedBlock(markdown);

    expect(result).toContain("## Inside");
    expect(result).not.toContain("# Before");
    expect(result).not.toContain("# After");
  });
});
