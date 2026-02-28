import type { JsonObject } from "../domain/profile-types.js";
import { isJsonObject } from "../domain/profile-types.js";

const LEGACY_USER_HOME = process.env.OC_LEGACY_USER_HOME ?? "/Users/guard2";

/**
 * Describes a plugin that must always be present in the resolved
 * plugin list.  The `matchPatterns` array contains substrings that
 * identify existing specifiers belonging to this logical plugin so
 * they can be deduplicated before the canonical specifier is prepended.
 */
interface RequiredPlugin {
  /**
   * Returns the canonical specifier to inject. Receives the resolved
   * home directory so file-path plugins can be location-independent.
   */
  canonicalSpecifier: (homeDir: string) => string;
  /** Substrings to match against existing plugin specifiers. */
  matchPatterns: string[];
}

const REQUIRED_PLUGINS: RequiredPlugin[] = [
  {
    canonicalSpecifier: () => "opencode-antigravity-auth@1.6.0",
    matchPatterns: ["antigravity"]
  },
  {
    canonicalSpecifier: () => "@guard22/opencode-multi-auth-codex",
    matchPatterns: ["multi-auth"]
  },
  {
    canonicalSpecifier: (homeDir) => {
      const morphHome = homeDir || LEGACY_USER_HOME;
      return `file://${morphHome}/.config/opencode/local-plugins/opencode-morph-fast-apply/index.ts`;
    },
    matchPatterns: ["morph-fast-apply"]
  }
];

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

function isRequiredPlugin(specifier: string): boolean {
  return REQUIRED_PLUGINS.some((plugin) =>
    plugin.matchPatterns.some((pattern) => specifier.includes(pattern))
  );
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
    (specifier) => !isRequiredPlugin(specifier)
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

  const requiredSpecifiers = REQUIRED_PLUGINS.map((plugin) =>
    plugin.canonicalSpecifier(homeDir)
  );
  config.plugin = [...requiredSpecifiers, ...dedupedAdditional];
}
