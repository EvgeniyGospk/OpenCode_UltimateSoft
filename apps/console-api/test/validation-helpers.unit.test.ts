import { describe, expect, it } from "vitest";
import {
  normalizeConfigKey,
  ensureValidConfigKey,
  normalizeAgentKeyPool,
  normalizeKeyPool,
  inferTaskMetadataForKey,
  toIsoString,
  normalizeTaskExposure,
  AGENT_KEY_PATTERN
} from "../src/modules/profile/application/validation-helpers.js";
import { ProfileServiceError } from "../src/modules/profile/domain/errors.js";

// ---------------------------------------------------------------------------
// normalizeConfigKey
// ---------------------------------------------------------------------------
describe("normalizeConfigKey", () => {
  it("returns the key unchanged when already trimmed", () => {
    expect(normalizeConfigKey("my-agent")).toBe("my-agent");
  });

  it("trims leading whitespace", () => {
    expect(normalizeConfigKey("  leading")).toBe("leading");
  });

  it("trims trailing whitespace", () => {
    expect(normalizeConfigKey("trailing  ")).toBe("trailing");
  });

  it("trims both sides", () => {
    expect(normalizeConfigKey("  both  ")).toBe("both");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeConfigKey("   ")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeConfigKey("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// AGENT_KEY_PATTERN
// ---------------------------------------------------------------------------
describe("AGENT_KEY_PATTERN", () => {
  it("matches simple alphanumeric keys", () => {
    expect(AGENT_KEY_PATTERN.test("agent1")).toBe(true);
  });

  it("matches keys with dots, underscores, and dashes", () => {
    expect(AGENT_KEY_PATTERN.test("my-agent_v2.1")).toBe(true);
  });

  it("matches single character key", () => {
    expect(AGENT_KEY_PATTERN.test("a")).toBe(true);
  });

  it("rejects keys starting with a dot", () => {
    expect(AGENT_KEY_PATTERN.test(".hidden")).toBe(false);
  });

  it("rejects keys starting with a dash", () => {
    expect(AGENT_KEY_PATTERN.test("-agent")).toBe(false);
  });

  it("rejects keys starting with an underscore", () => {
    expect(AGENT_KEY_PATTERN.test("_agent")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(AGENT_KEY_PATTERN.test("")).toBe(false);
  });

  it("rejects keys with spaces", () => {
    expect(AGENT_KEY_PATTERN.test("bad key")).toBe(false);
  });

  it("rejects keys with special characters", () => {
    expect(AGENT_KEY_PATTERN.test("bad!key")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ensureValidConfigKey
// ---------------------------------------------------------------------------
describe("ensureValidConfigKey", () => {
  it("returns normalized key for valid input", () => {
    expect(ensureValidConfigKey("agent", "my-agent")).toBe("my-agent");
  });

  it("trims and validates", () => {
    expect(ensureValidConfigKey("agent", "  my-agent  ")).toBe("my-agent");
  });

  it("throws ProfileServiceError for invalid key", () => {
    expect(() => ensureValidConfigKey("agent", "bad key!")).toThrow(
      ProfileServiceError
    );
  });

  it("throws with INVALID_KEY code", () => {
    try {
      ensureValidConfigKey("agent", "");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileServiceError);
      expect((error as ProfileServiceError).code).toBe("INVALID_KEY");
    }
  });

  it("throws with 400 status code", () => {
    try {
      ensureValidConfigKey("provider", "!invalid");
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as ProfileServiceError).statusCode).toBe(400);
    }
  });

  it("includes key in error details", () => {
    try {
      ensureValidConfigKey("agent", " .bad ");
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as ProfileServiceError).details).toEqual({ key: ".bad" });
    }
  });
});

// ---------------------------------------------------------------------------
// normalizeAgentKeyPool
// ---------------------------------------------------------------------------
describe("normalizeAgentKeyPool", () => {
  it("returns 'any' when value is 'any'", () => {
    expect(normalizeAgentKeyPool("any")).toBe("any");
  });

  it("returns 'software' when value is 'software'", () => {
    expect(normalizeAgentKeyPool("software")).toBe("software");
  });

  it("returns 'default' when value is 'default'", () => {
    expect(normalizeAgentKeyPool("default")).toBe("default");
  });

  it("returns fallback for unrecognised value", () => {
    expect(normalizeAgentKeyPool("unknown")).toBe("any");
  });

  it("returns custom fallback when provided", () => {
    expect(normalizeAgentKeyPool("bad", "software")).toBe("software");
  });

  it("returns fallback for null", () => {
    expect(normalizeAgentKeyPool(null)).toBe("any");
  });

  it("returns fallback for undefined", () => {
    expect(normalizeAgentKeyPool(undefined)).toBe("any");
  });

  it("returns fallback for number", () => {
    expect(normalizeAgentKeyPool(42)).toBe("any");
  });
});

// ---------------------------------------------------------------------------
// normalizeKeyPool
// ---------------------------------------------------------------------------
describe("normalizeKeyPool", () => {
  it("returns 'any' for valid 'any' value", () => {
    expect(normalizeKeyPool("any")).toBe("any");
  });

  it("returns 'software' for valid value", () => {
    expect(normalizeKeyPool("software")).toBe("software");
  });

  it("returns 'default' for valid value", () => {
    expect(normalizeKeyPool("default")).toBe("default");
  });

  it("returns null for unrecognised string", () => {
    expect(normalizeKeyPool("unknown")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(normalizeKeyPool(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeKeyPool(undefined)).toBeNull();
  });

  it("returns null for number input", () => {
    expect(normalizeKeyPool(123)).toBeNull();
  });

  it("returns null for boolean input", () => {
    expect(normalizeKeyPool(true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeTaskExposure
// ---------------------------------------------------------------------------
describe("normalizeTaskExposure", () => {
  it("returns 'direct' for 'direct'", () => {
    expect(normalizeTaskExposure("direct")).toBe("direct");
  });

  it("returns 'alias' for 'alias'", () => {
    expect(normalizeTaskExposure("alias")).toBe("alias");
  });

  it("returns 'off' for 'off'", () => {
    expect(normalizeTaskExposure("off")).toBe("off");
  });

  it("returns 'off' for unrecognized string", () => {
    expect(normalizeTaskExposure("unknown")).toBe("off");
  });

  it("returns 'off' for null", () => {
    expect(normalizeTaskExposure(null)).toBe("off");
  });

  it("returns 'off' for undefined", () => {
    expect(normalizeTaskExposure(undefined)).toBe("off");
  });
});

// ---------------------------------------------------------------------------
// inferTaskMetadataForKey
// ---------------------------------------------------------------------------
describe("inferTaskMetadataForKey", () => {
  const emptyAllowed = new Set<string>();

  it("returns alias exposure for known alias key 'codex-websearch'", () => {
    const result = inferTaskMetadataForKey("codex-websearch", emptyAllowed);
    expect(result.taskExposure).toBe("alias");
    expect(result.taskAlias).toBe("codex-search");
  });

  it("returns direct exposure for default direct keys", () => {
    const directKeys = [
      "general",
      "explore",
      "sonnet",
      "opus",
      "codex-search",
      "gemini-analyst",
      "designer"
    ];
    for (const key of directKeys) {
      const result = inferTaskMetadataForKey(key, emptyAllowed);
      expect(result.taskExposure).toBe("direct");
      expect(result).not.toHaveProperty("taskAlias");
    }
  });

  it("returns direct exposure for keys in allowedBuildTaskKeys", () => {
    const allowed = new Set(["custom-agent"]);
    const result = inferTaskMetadataForKey("custom-agent", allowed);
    expect(result.taskExposure).toBe("direct");
  });

  it("returns off exposure for unknown key with empty allowed set", () => {
    const result = inferTaskMetadataForKey("random-agent", emptyAllowed);
    expect(result.taskExposure).toBe("off");
  });

  it("alias takes priority over allowed build task keys", () => {
    const allowed = new Set(["codex-websearch"]);
    const result = inferTaskMetadataForKey("codex-websearch", allowed);
    expect(result.taskExposure).toBe("alias");
    expect(result.taskAlias).toBe("codex-search");
  });
});

// ---------------------------------------------------------------------------
// toIsoString
// ---------------------------------------------------------------------------
describe("toIsoString", () => {
  it("returns ISO string for a valid date string", () => {
    const result = toIsoString("2026-02-26T00:00:00.000Z", "fallback");
    expect(result).toBe("2026-02-26T00:00:00.000Z");
  });

  it("parses and re-formats a non-ISO date string", () => {
    const result = toIsoString("February 26, 2026", "fallback");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns fallback for non-string value", () => {
    expect(toIsoString(123, "fallback")).toBe("fallback");
  });

  it("returns fallback for null", () => {
    expect(toIsoString(null, "fallback")).toBe("fallback");
  });

  it("returns fallback for undefined", () => {
    expect(toIsoString(undefined, "fallback")).toBe("fallback");
  });

  it("returns fallback for invalid date string", () => {
    expect(toIsoString("not-a-date", "default-value")).toBe("default-value");
  });

  it("returns fallback for empty string", () => {
    expect(toIsoString("", "fallback")).toBe("fallback");
  });
});
