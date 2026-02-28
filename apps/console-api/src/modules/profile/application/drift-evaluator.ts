import type { JsonObject } from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";
import { readPluginSpecifiers } from "./plugin-resolver.js";
import { readManagedBlock } from "./markdown-renderer.js";
import type { AgentRegistryDocument } from "./agent-registry.js";
import { projectRegistryToOpencodeConfig } from "./agent-registry.js";
import { projectRegistryToAgentsMarkdown } from "./markdown-renderer.js";
import { readBuildTaskSection } from "./validation-helpers.js";

export function evaluateRegistryDrift(
  opencodeJson: JsonObject,
  agentsMarkdown: string,
  registry: AgentRegistryDocument
) {
  const issues: string[] = [];
  const projectedConfig = projectRegistryToOpencodeConfig(opencodeJson, registry);
  const projectedMarkdown = projectRegistryToAgentsMarkdown(agentsMarkdown, registry);

  const currentAgents = isJsonObject(opencodeJson.agent) ? opencodeJson.agent : {};
  const projectedAgents = isJsonObject(projectedConfig.agent)
    ? projectedConfig.agent
    : {};

  if (JSON.stringify(currentAgents) !== JSON.stringify(projectedAgents)) {
    issues.push("opencode.json agent map differs from registry projection");
  }

  const currentTaskMap = readBuildTaskSection(opencodeJson) ?? {};
  const projectedTaskMap = readBuildTaskSection(projectedConfig) ?? {};
  if (JSON.stringify(currentTaskMap) !== JSON.stringify(projectedTaskMap)) {
    issues.push("build task permissions differ from registry projection");
  }

  const currentPlugins = readPluginSpecifiers(opencodeJson);
  const projectedPlugins = readPluginSpecifiers(projectedConfig);
  if (JSON.stringify(currentPlugins) !== JSON.stringify(projectedPlugins)) {
    issues.push("opencode.json plugin list differs from registry projection");
  }

  const currentBlock = readManagedBlock(agentsMarkdown);
  const projectedBlock = readManagedBlock(projectedMarkdown);
  if (currentBlock !== projectedBlock) {
    issues.push("AGENTS.md managed routing block differs from registry projection");
  }

  return {
    inSync: issues.length === 0,
    issues
  };
}
