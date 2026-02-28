import { describe, it, expect } from "vitest";
import {
  formatJson,
  toProviderItemsFromConfig,
  toDraftMap,
} from "@/lib/providers-domain";
import type { ProviderItem } from "@/lib/providers-domain";

// ---------------------------------------------------------------------------
// formatJson
// ---------------------------------------------------------------------------

describe("formatJson", () => {
  it("formats a simple object with 2-space indentation", () => {
    expect(formatJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("formats nested objects", () => {
    const result = formatJson({ a: { b: 2 } });
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
    expect(result).toBe(JSON.stringify({ a: { b: 2 } }, null, 2));
  });

  it("formats null", () => {
    expect(formatJson(null)).toBe("null");
  });

  it("formats a string", () => {
    expect(formatJson("hello")).toBe('"hello"');
  });

  it("formats an array", () => {
    expect(formatJson([1, 2])).toBe("[\n  1,\n  2\n]");
  });

  it("formats an empty object", () => {
    expect(formatJson({})).toBe("{}");
  });
});

// ---------------------------------------------------------------------------
// toProviderItemsFromConfig
// ---------------------------------------------------------------------------

describe("toProviderItemsFromConfig", () => {
  it("converts a config object to ProviderItem[]", () => {
    const config = {
      anthropic: { apiKey: "sk-123", models: {} },
      openai: { apiKey: "sk-456", models: {} },
    };
    const items = toProviderItemsFromConfig(config);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ key: "anthropic", definition: config.anthropic });
    expect(items[1]).toEqual({ key: "openai", definition: config.openai });
  });

  it("skips non-object definitions", () => {
    const config = {
      good: { apiKey: "sk-123" },
      bad: "not an object",
      worse: null,
      alsobad: 42,
    };
    const items = toProviderItemsFromConfig(config);

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("good");
  });

  it("returns empty array for null", () => {
    expect(toProviderItemsFromConfig(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(toProviderItemsFromConfig(undefined)).toEqual([]);
  });

  it("returns empty array for a string", () => {
    expect(toProviderItemsFromConfig("hello")).toEqual([]);
  });

  it("returns empty array for a number", () => {
    expect(toProviderItemsFromConfig(123)).toEqual([]);
  });

  it("returns empty array for an array", () => {
    expect(toProviderItemsFromConfig([1, 2])).toEqual([]);
  });

  it("returns empty array for an empty object", () => {
    expect(toProviderItemsFromConfig({})).toEqual([]);
  });

  it("handles a config with array definitions (skipped)", () => {
    const config = {
      provider1: [1, 2, 3],
      provider2: { valid: true },
    };
    const items = toProviderItemsFromConfig(config);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("provider2");
  });
});

// ---------------------------------------------------------------------------
// toDraftMap
// ---------------------------------------------------------------------------

describe("toDraftMap", () => {
  it("converts items to a key→JSON map", () => {
    const items = [
      { key: "anthropic", definition: { apiKey: "sk-123" } },
      { key: "openai", definition: { apiKey: "sk-456" } },
    ];
    const drafts = toDraftMap(items as unknown as ProviderItem[]);

    expect(drafts).toEqual({
      anthropic: JSON.stringify({ apiKey: "sk-123" }, null, 2),
      openai: JSON.stringify({ apiKey: "sk-456" }, null, 2),
    });
  });

  it("returns an empty object for an empty array", () => {
    expect(toDraftMap([])).toEqual({});
  });

  it("handles complex nested definitions", () => {
    const items = [
      {
        key: "complex",
        definition: { models: { "gpt-5": { variants: { low: {} } } } },
      },
    ];
    const drafts = toDraftMap(items as unknown as ProviderItem[]);

    expect(JSON.parse(drafts["complex"])).toEqual({
      models: { "gpt-5": { variants: { low: {} } } },
    });
  });
});
