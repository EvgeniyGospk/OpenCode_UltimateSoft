import { describe, it, expect } from "vitest";
import type { AgentItem } from "@/lib/agents-domain";
import {
  parseModelRef,
  composeModelRef,
  getVariantRank,
  buildModelCatalog,
  pushModelRef,
  readModel,
  readVariant,
  formatVariantLabel,
  inferModelVariants,
  toTimestamp,
  sortAgents,
  toSelectOptions,
} from "@/lib/agents-domain";

/** Create an invalid definition object for negative-case tests. */
function invalidDef(overrides: Record<string, unknown>) {
  return overrides as AgentItem["definition"];
}

// ---------------------------------------------------------------------------
// parseModelRef
// ---------------------------------------------------------------------------

describe("parseModelRef", () => {
  it("parses a provider/model string", () => {
    expect(parseModelRef("anthropic/claude-sonnet-4-6")).toEqual({
      prefix: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
  });

  it("returns empty strings for an empty input", () => {
    expect(parseModelRef("")).toEqual({ prefix: "", modelId: "" });
  });

  it("returns empty strings for whitespace-only input", () => {
    expect(parseModelRef("   ")).toEqual({ prefix: "", modelId: "" });
  });

  it("returns empty prefix when there is no slash", () => {
    expect(parseModelRef("gpt-4o")).toEqual({ prefix: "", modelId: "gpt-4o" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseModelRef("  openai/gpt-5  ")).toEqual({
      prefix: "openai",
      modelId: "gpt-5",
    });
  });

  it("handles multiple slashes (splits on first)", () => {
    expect(parseModelRef("a/b/c")).toEqual({ prefix: "a", modelId: "b/c" });
  });
});

// ---------------------------------------------------------------------------
// composeModelRef
// ---------------------------------------------------------------------------

describe("composeModelRef", () => {
  it("composes prefix and modelId with a slash", () => {
    expect(composeModelRef("anthropic", "claude-opus-4-6")).toBe(
      "anthropic/claude-opus-4-6"
    );
  });

  it("returns just modelId when prefix is empty", () => {
    expect(composeModelRef("", "gpt-4o")).toBe("gpt-4o");
  });

  it("returns empty string when modelId is empty", () => {
    expect(composeModelRef("openai", "")).toBe("");
  });

  it("returns empty string when both are empty", () => {
    expect(composeModelRef("", "")).toBe("");
  });

  it("trims whitespace from prefix and modelId", () => {
    expect(composeModelRef("  openai  ", "  gpt-5  ")).toBe("openai/gpt-5");
  });

  it("returns empty when modelId is whitespace-only", () => {
    expect(composeModelRef("openai", "   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getVariantRank
// ---------------------------------------------------------------------------

describe("getVariantRank", () => {
  it("returns correct rank for known variants", () => {
    expect(getVariantRank("low")).toBe(0);
    expect(getVariantRank("medium")).toBe(1);
    expect(getVariantRank("high")).toBe(2);
    expect(getVariantRank("max")).toBe(3);
    expect(getVariantRank("xhigh")).toBe(4);
    expect(getVariantRank("extra-high")).toBe(5);
    expect(getVariantRank("extra_high")).toBe(6);
  });

  it("is case-insensitive", () => {
    expect(getVariantRank("LOW")).toBe(0);
    expect(getVariantRank("Medium")).toBe(1);
    expect(getVariantRank("HIGH")).toBe(2);
  });

  it("trims whitespace", () => {
    expect(getVariantRank("  max  ")).toBe(3);
  });

  it("returns MAX_SAFE_INTEGER for unknown variants", () => {
    expect(getVariantRank("unknown")).toBe(Number.MAX_SAFE_INTEGER);
    expect(getVariantRank("")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("sorts known variants before unknown ones", () => {
    const variants = ["custom", "low", "max", "zzz", "medium"];
    const sorted = [...variants].sort(
      (a, b) => getVariantRank(a) - getVariantRank(b)
    );
    expect(sorted).toEqual(["low", "medium", "max", "custom", "zzz"]);
  });
});

// ---------------------------------------------------------------------------
// buildModelCatalog
// ---------------------------------------------------------------------------

describe("buildModelCatalog", () => {
  it("groups models by prefix", () => {
    const catalog = buildModelCatalog([
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-opus-4-6",
      "openai/gpt-5",
    ]);

    expect(catalog.prefixes).toEqual(["anthropic", "openai"]);
    expect(catalog.modelIdsByPrefix["anthropic"]).toEqual([
      "claude-opus-4-6",
      "claude-sonnet-4-6",
    ]);
    expect(catalog.modelIdsByPrefix["openai"]).toEqual(["gpt-5"]);
  });

  it("handles models without a prefix", () => {
    const catalog = buildModelCatalog(["gpt-4o", "anthropic/claude-sonnet-4-6"]);
    expect(catalog.prefixes).toEqual(["", "anthropic"]);
    expect(catalog.modelIdsByPrefix[""]).toEqual(["gpt-4o"]);
  });

  it("returns empty catalog for empty pool", () => {
    const catalog = buildModelCatalog([]);
    expect(catalog.prefixes).toEqual([]);
    expect(catalog.modelIdsByPrefix).toEqual({});
  });

  it("deduplicates models within the same prefix", () => {
    const catalog = buildModelCatalog([
      "openai/gpt-5",
      "openai/gpt-5",
    ]);
    expect(catalog.modelIdsByPrefix["openai"]).toEqual(["gpt-5"]);
  });
});

// ---------------------------------------------------------------------------
// pushModelRef
// ---------------------------------------------------------------------------

describe("pushModelRef", () => {
  it("adds a trimmed value to the set", () => {
    const pool = new Set<string>();
    pushModelRef(pool, "  openai/gpt-5  ");
    expect(pool.has("openai/gpt-5")).toBe(true);
  });

  it("ignores empty strings", () => {
    const pool = new Set<string>();
    pushModelRef(pool, "");
    pushModelRef(pool, "   ");
    expect(pool.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// readModel / readVariant
// ---------------------------------------------------------------------------

describe("readModel", () => {
  it("returns the model string from a definition", () => {
    expect(readModel(invalidDef({ model: "anthropic/claude-sonnet-4-6" }))).toBe(
      "anthropic/claude-sonnet-4-6"
    );
  });

  it("returns empty string for a non-string model", () => {
    expect(readModel(invalidDef({ model: 123 }))).toBe("");
    expect(readModel(invalidDef({}))).toBe("");
  });
});

describe("readVariant", () => {
  it("returns the variant string from a definition", () => {
    expect(readVariant(invalidDef({ variant: "high" }))).toBe("high");
  });

  it("returns empty string for a non-string variant", () => {
    expect(readVariant(invalidDef({ variant: null }))).toBe("");
    expect(readVariant(invalidDef({}))).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatVariantLabel
// ---------------------------------------------------------------------------

describe("formatVariantLabel", () => {
  it("capitalizes the first letter", () => {
    expect(formatVariantLabel("low")).toBe("Low");
    expect(formatVariantLabel("high")).toBe("High");
  });

  it('returns "Default" for empty/whitespace', () => {
    expect(formatVariantLabel("")).toBe("Default");
    expect(formatVariantLabel("   ")).toBe("Default");
  });

  it('returns "Xhigh" for lowercase xhigh', () => {
    expect(formatVariantLabel("xhigh")).toBe("Xhigh");
  });

  it("capitalizes first letter for non-xhigh uppercase input", () => {
    // "XHIGH" !== "xhigh" so it goes through the normal path: "X" + "HIGH" = "XHIGH"
    // Actually the code does: normalized.charAt(0).toUpperCase() + normalized.slice(1)
    // where normalized = "XHIGH" (trimmed input). lower = "xhigh".
    // lower === "xhigh" matches, so it returns "Xhigh".
    expect(formatVariantLabel("XHIGH")).toBe("Xhigh");
  });
});

// ---------------------------------------------------------------------------
// inferModelVariants
// ---------------------------------------------------------------------------

describe("inferModelVariants", () => {
  it("returns claude variants for anthropic/claude-*", () => {
    expect(inferModelVariants("anthropic/claude-sonnet-4-6")).toEqual([
      "low",
      "medium",
      "high",
      "max",
    ]);
  });

  it("returns codex variants for openai/gpt-5*", () => {
    expect(inferModelVariants("openai/gpt-5")).toEqual([
      "low",
      "medium",
      "high",
      "max",
      "xhigh",
    ]);
  });

  it("returns codex variants for openai codex models", () => {
    expect(inferModelVariants("openai/codex-mini")).toEqual([
      "low",
      "medium",
      "high",
      "max",
      "xhigh",
    ]);
  });

  it("returns empty array for unknown providers/models", () => {
    expect(inferModelVariants("google/gemini-pro")).toEqual([]);
    expect(inferModelVariants("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toTimestamp
// ---------------------------------------------------------------------------

describe("toTimestamp", () => {
  it("parses an ISO date string", () => {
    const ts = toTimestamp("2024-01-15T10:30:00Z");
    expect(ts).toBeGreaterThan(0);
  });

  it("returns 0 for an invalid date", () => {
    expect(toTimestamp("not-a-date")).toBe(0);
    expect(toTimestamp("")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toSelectOptions
// ---------------------------------------------------------------------------

describe("toSelectOptions", () => {
  it("returns a sorted list with the current value included", () => {
    const options = toSelectOptions(["b", "a"], "c");
    expect(options).toEqual(["a", "b", "c"]);
  });

  it("does not duplicate the current value if already in pool", () => {
    const options = toSelectOptions(["a", "b"], "b");
    expect(options).toEqual(["a", "b"]);
  });

  it("ignores whitespace-only current value", () => {
    const options = toSelectOptions(["a", "b"], "   ");
    expect(options).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// sortAgents (minimal — uses toTimestamp internally)
// ---------------------------------------------------------------------------

describe("sortAgents", () => {
  const agents = [
    { key: "bravo", createdAt: "2024-01-02T00:00:00Z" },
    { key: "alpha", createdAt: "2024-01-01T00:00:00Z" },
    { key: "charlie", createdAt: "2024-01-03T00:00:00Z" },
  ] as unknown as AgentItem[];

  it("sorts by key ascending", () => {
    const sorted = sortAgents(agents, "key-asc");
    expect(sorted.map((a) => a.key)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("sorts by key descending", () => {
    const sorted = sortAgents(agents, "key-desc");
    expect(sorted.map((a) => a.key)).toEqual(["charlie", "bravo", "alpha"]);
  });

  it("sorts by created ascending", () => {
    const sorted = sortAgents(agents, "created-asc");
    expect(sorted.map((a) => a.key)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("sorts by created descending", () => {
    const sorted = sortAgents(agents, "created-desc");
    expect(sorted.map((a) => a.key)).toEqual(["charlie", "bravo", "alpha"]);
  });

  it("does not mutate the original array", () => {
    const copy = [...agents];
    sortAgents(agents, "key-asc");
    expect(agents).toEqual(copy);
  });
});
