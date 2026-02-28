import { describe, expect, it, afterEach } from "vitest";
import {
  resolveHomeDir,
  rewriteLegacyPathsInValue,
  applyRequiredPlugins,
  readPluginSpecifiers
} from "../src/modules/profile/application/plugin-resolver.js";
import type { JsonObject } from "../src/modules/profile/domain/profile-types.js";

describe("resolveHomeDir", () => {
  const originalHome = process.env.HOME;

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("returns HOME value when set", () => {
    process.env.HOME = "/home/testuser";
    expect(resolveHomeDir()).toBe("/home/testuser");
  });

  it("strips trailing slash from HOME", () => {
    process.env.HOME = "/home/testuser/";
    expect(resolveHomeDir()).toBe("/home/testuser");
  });

  it("returns empty string when HOME is not set", () => {
    delete process.env.HOME;
    expect(resolveHomeDir()).toBe("");
  });

  it("returns empty string when HOME is empty", () => {
    process.env.HOME = "";
    expect(resolveHomeDir()).toBe("");
  });

  it("returns empty string when HOME is whitespace only", () => {
    process.env.HOME = "   ";
    expect(resolveHomeDir()).toBe("");
  });

  it("trims whitespace from HOME", () => {
    process.env.HOME = "  /home/testuser  ";
    expect(resolveHomeDir()).toBe("/home/testuser");
  });

  it("handles HOME without trailing slash", () => {
    process.env.HOME = "/Users/dev";
    expect(resolveHomeDir()).toBe("/Users/dev");
  });
});

describe("rewriteLegacyPathsInValue", () => {
  const HOME = "/home/currentuser";

  it("rewrites string values containing legacy path", () => {
    const input = "/Users/guard2/.config/opencode/plugins/index.ts";
    const result = rewriteLegacyPathsInValue(input, HOME);

    expect(result).toBe("/home/currentuser/.config/opencode/plugins/index.ts");
  });

  it("returns string unchanged when no legacy path present", () => {
    const input = "/home/other/.config/opencode/file.ts";
    const result = rewriteLegacyPathsInValue(input, HOME);

    expect(result).toBe(input);
  });

  it("returns value unchanged when homeDir is empty", () => {
    const input = "/Users/guard2/.config/opencode/file.ts";
    const result = rewriteLegacyPathsInValue(input, "");

    expect(result).toBe(input);
  });

  it("rewrites strings inside arrays", () => {
    const input = [
      "/Users/guard2/.config/opencode/a.ts",
      "/other/path/b.ts"
    ];
    const result = rewriteLegacyPathsInValue(input, HOME) as string[];

    expect(result[0]).toBe("/home/currentuser/.config/opencode/a.ts");
    expect(result[1]).toBe("/other/path/b.ts");
  });

  it("rewrites strings inside nested objects", () => {
    const input: JsonObject = {
      path: "/Users/guard2/.config/opencode/plugin.ts",
      nested: {
        scriptPath: "/Users/guard2/.config/opencode/script.ts"
      }
    };

    const result = rewriteLegacyPathsInValue(input, HOME) as JsonObject;

    expect(result.path).toBe("/home/currentuser/.config/opencode/plugin.ts");
    expect((result.nested as JsonObject).scriptPath).toBe(
      "/home/currentuser/.config/opencode/script.ts"
    );
  });

  it("handles deeply nested arrays and objects", () => {
    const input: JsonObject = {
      level1: {
        level2: [
          "/Users/guard2/.config/deep.ts",
          {
            level3: "/Users/guard2/.config/deeper.ts"
          }
        ]
      }
    };

    const result = rewriteLegacyPathsInValue(input, HOME) as JsonObject;
    const level2 = (result.level1 as JsonObject).level2 as unknown[];

    expect(level2[0]).toBe("/home/currentuser/.config/deep.ts");
    expect((level2[1] as JsonObject).level3).toBe(
      "/home/currentuser/.config/deeper.ts"
    );
  });

  it("handles non-string/non-object values (numbers, booleans, null)", () => {
    expect(rewriteLegacyPathsInValue(42, HOME)).toBe(42);
    expect(rewriteLegacyPathsInValue(true, HOME)).toBe(true);
    expect(rewriteLegacyPathsInValue(null, HOME)).toBeNull();
  });

  it("replaces all occurrences of legacy path in a single string", () => {
    const input = "/Users/guard2/a:/Users/guard2/b";
    const result = rewriteLegacyPathsInValue(input, HOME);

    expect(result).toBe("/home/currentuser/a:/home/currentuser/b");
  });
});

describe("applyRequiredPlugins", () => {
  const HOME = "/home/testuser";

  it("adds required plugins to empty config", () => {
    const config: JsonObject = {};
    applyRequiredPlugins(config, HOME);

    const plugins = config.plugin as string[];
    expect(plugins).toHaveLength(3);
    expect(plugins[0]).toContain("opencode-antigravity-auth");
    expect(plugins[1]).toContain("opencode-multi-auth-codex");
    expect(plugins[2]).toContain("opencode-morph-fast-apply");
  });

  it("replaces existing required plugin specifiers with canonical versions", () => {
    const config: JsonObject = {
      plugin: [
        "opencode-antigravity-auth@0.1.0",
        "@guard22/opencode-multi-auth-codex",
        "file:///Users/guard2/.config/opencode/local-plugins/opencode-morph-fast-apply/index.ts"
      ]
    };

    applyRequiredPlugins(config, HOME);

    const plugins = config.plugin as string[];
    expect(plugins).toHaveLength(3);
    expect(plugins[0]).toBe("opencode-antigravity-auth@1.6.0");
    expect(plugins[1]).toBe("@guard22/opencode-multi-auth-codex");
    expect(plugins[2]).toContain(HOME);
  });

  it("preserves extra non-required plugins after required ones", () => {
    const config: JsonObject = {
      plugin: [
        "opencode-antigravity-auth@old",
        "custom-plugin@2.0.0",
        "another-plugin@1.0.0"
      ]
    };

    applyRequiredPlugins(config, HOME);

    const plugins = config.plugin as string[];
    expect(plugins.length).toBeGreaterThanOrEqual(5);
    expect(plugins).toContain("custom-plugin@2.0.0");
    expect(plugins).toContain("another-plugin@1.0.0");
  });

  it("deduplicates extra plugins", () => {
    const config: JsonObject = {
      plugin: [
        "custom-plugin@1.0.0",
        "custom-plugin@1.0.0",
        "custom-plugin@1.0.0"
      ]
    };

    applyRequiredPlugins(config, HOME);

    const plugins = config.plugin as string[];
    const customCount = plugins.filter((p) => p === "custom-plugin@1.0.0").length;
    expect(customCount).toBe(1);
  });

  it("handles non-array plugin field gracefully", () => {
    const config: JsonObject = {
      plugin: "not-an-array"
    };

    applyRequiredPlugins(config, HOME);

    const plugins = config.plugin as string[];
    expect(plugins).toHaveLength(3);
  });

  it("filters out empty/whitespace plugin specifiers", () => {
    const config: JsonObject = {
      plugin: ["  ", "", "custom-plugin@1.0.0"]
    };

    applyRequiredPlugins(config, HOME);

    const plugins = config.plugin as string[];
    expect(plugins).toContain("custom-plugin@1.0.0");
    const emptyPlugins = plugins.filter((p) => p.trim() === "");
    expect(emptyPlugins).toHaveLength(0);
  });

  it("rewrites legacy paths in existing specifiers before dedup", () => {
    const config: JsonObject = {
      plugin: [
        "file:///Users/guard2/.config/opencode/custom/index.ts",
        "file:///Users/guard2/.config/opencode/custom/index.ts"
      ]
    };

    applyRequiredPlugins(config, HOME);

    const plugins = config.plugin as string[];
    const customPlugins = plugins.filter((p) =>
      p.includes("/home/testuser/.config/opencode/custom/index.ts")
    );
    expect(customPlugins).toHaveLength(1);
  });
});

describe("readPluginSpecifiers", () => {
  it("returns string entries from plugin array", () => {
    const config: JsonObject = {
      plugin: ["plugin-a", "plugin-b"]
    };

    expect(readPluginSpecifiers(config)).toEqual(["plugin-a", "plugin-b"]);
  });

  it("filters out non-string entries", () => {
    const config: JsonObject = {
      plugin: ["plugin-a", 42, null, "plugin-b", true]
    };

    expect(readPluginSpecifiers(config)).toEqual(["plugin-a", "plugin-b"]);
  });

  it("returns empty array when plugin is not an array", () => {
    expect(readPluginSpecifiers({ plugin: "nope" })).toEqual([]);
    expect(readPluginSpecifiers({})).toEqual([]);
  });
});
