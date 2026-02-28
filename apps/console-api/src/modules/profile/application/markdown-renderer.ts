import type { JsonObject } from "../domain/profile-types.js";
import type { AgentRegistryDocument } from "./agent-registry.js";

const MANAGED_BLOCK_START = "<!-- OPENCODE_CONSOLE_MANAGED_ROUTING:START -->";
const MANAGED_BLOCK_END = "<!-- OPENCODE_CONSOLE_MANAGED_ROUTING:END -->";

function readModelId(definition: JsonObject): string {
  const rawModel = definition.model;
  return typeof rawModel === "string" ? rawModel : "unknown-model";
}

function renderManagedRoutingBlock(registry: AgentRegistryDocument) {
  const direct = registry.agents.filter((entry) => entry.taskExposure === "direct");
  const aliases = registry.agents.filter((entry) => entry.taskExposure === "alias");

  const lines: string[] = [
    MANAGED_BLOCK_START,
    "## OpenCode Console Managed Routing",
    "This section is auto-generated from `agents.registry.json`. Do not edit manually.",
    "",
    "### Task-exposed Agents (direct)",
    ...(direct.length > 0
      ? direct.map(
          (entry) => `- \`${entry.key}\` (\`${readModelId(entry.definition)}\`)`
        )
      : ["- _none_"]),
    "",
    "### Task Aliases",
    ...(aliases.length > 0
      ? aliases.map((entry) =>
          entry.taskAlias
            ? `- \`${entry.key}\` -> \`${entry.taskAlias}\` (\`${readModelId(entry.definition)}\`)`
            : `- \`${entry.key}\` -> _missing alias_ (\`${readModelId(entry.definition)}\`)`
        )
      : ["- _none_"]),
    "",
    "### Registry Agents",
    ...registry.agents.map(
      (entry) =>
        `- \`${entry.key}\` (\`${readModelId(entry.definition)}\`, task: \`${entry.taskExposure}\`, pool: \`${entry.keyPool}\`)`
    ),
    MANAGED_BLOCK_END
  ];

  return `${lines.join("\n")}\n`;
}

function upsertManagedBlock(markdown: string, managedBlock: string) {
  const source = markdown.trimEnd();
  const blockRegex = new RegExp(
    `${MANAGED_BLOCK_START}[\\s\\S]*?${MANAGED_BLOCK_END}\\n?`,
    "m"
  );

  if (blockRegex.test(source)) {
    return `${source.replace(blockRegex, managedBlock).trimEnd()}\n`;
  }

  if (!source) {
    return managedBlock;
  }

  return `${source}\n\n${managedBlock}`;
}

export function projectRegistryToAgentsMarkdown(
  currentMarkdown: string,
  registry: AgentRegistryDocument
) {
  const managedBlock = renderManagedRoutingBlock(registry);
  return upsertManagedBlock(currentMarkdown, managedBlock);
}

export function readManagedBlock(markdown: string) {
  const blockRegex = new RegExp(
    `${MANAGED_BLOCK_START}[\\s\\S]*?${MANAGED_BLOCK_END}\\n?`,
    "m"
  );
  const matched = markdown.match(blockRegex);
  return matched?.[0]?.trim() ?? "";
}
