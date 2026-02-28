import type { JsonObject } from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";

const LEGACY_USER_HOME = "/Users/guard2";
const REQUIRED_ANTIGRAVITY_PLUGIN = "opencode-antigravity-auth@1.6.0";
const REQUIRED_MULTI_AUTH_PLUGIN = "@guard22/opencode-multi-auth-codex";

export function resolveHomeDir() {
  const home = process.env.HOME?.trim();
  if (!home) {
    return "";
  }

  return home.endsWith("/") ? home.slice(0, -1) : home;
}

export function rewriteLegacyUserPath(value: string, homeDir: string) {
  if (!homeDir) {
    return value;
  }

  if (!value.includes(LEGACY_USER_HOME)) {
    return value;
  }

  return value.replaceAll(LEGACY_USER_HOME, homeDir);
}

export function rewriteLegacyPathsInValue(value: unknown, homeDir: string): unknown {
  if (!homeDir) {
    return value;
  }

  if (typeof value === "string") {
    return rewriteLegacyUserPath(value, homeDir);
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = rewriteLegacyPathsInValue(value[index], homeDir);
    }
    return value;
  }

  if (isJsonObject(value)) {
    const obj = value as JsonObject;
    for (const [key, nestedValue] of Object.entries(obj)) {
      obj[key] = rewriteLegacyPathsInValue(nestedValue, homeDir);
    }
  }

  return value;
}

function isAntigravityPlugin(specifier: string) {
  return specifier.includes("opencode-antigravity-auth");
}

function isMultiAuthPlugin(specifier: string) {
  return specifier.includes("opencode-multi-auth-codex");
}

function isMorphFastApplyPlugin(specifier: string) {
  return specifier.includes("opencode-morph-fast-apply");
}

function buildRequiredPluginSpecifiers(homeDir: string) {
  const morphHome = homeDir || LEGACY_USER_HOME;
  return [
    REQUIRED_ANTIGRAVITY_PLUGIN,
    REQUIRED_MULTI_AUTH_PLUGIN,
    `file://${morphHome}/.config/opencode/local-plugins/opencode-morph-fast-apply/index.ts`
  ];
}

export function readPluginSpecifiers(config: JsonObject) {
  if (!Array.isArray(config.plugin)) {
    return [];
  }

  return config.plugin.filter((value): value is string => typeof value === "string");
}

export function applyRequiredPlugins(config: JsonObject, homeDir: string) {
  const existingSpecifiers = readPluginSpecifiers(config)
    .map((specifier) => rewriteLegacyUserPath(specifier.trim(), homeDir))
    .filter((specifier) => specifier.length > 0);

  const additionalSpecifiers = existingSpecifiers.filter(
    (specifier) =>
      !isAntigravityPlugin(specifier) &&
      !isMultiAuthPlugin(specifier) &&
      !isMorphFastApplyPlugin(specifier)
  );

  const dedupedAdditional: string[] = [];
  const dedupedAdditionalSet = new Set<string>();
  for (const specifier of additionalSpecifiers) {
    if (dedupedAdditionalSet.has(specifier)) {
      continue;
    }
    dedupedAdditionalSet.add(specifier);
    dedupedAdditional.push(specifier);
  }

  const requiredSpecifiers = buildRequiredPluginSpecifiers(homeDir);
  config.plugin = [...requiredSpecifiers, ...dedupedAdditional];
}
