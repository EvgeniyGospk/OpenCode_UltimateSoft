import { describe, expect, it } from "vitest";
import {
  splitModelRef,
  joinModelRef,
  inferPoolFromModelId,
  stripPoolSuffixFromModelId,
  stripTaskReasoningSuffixFromModelId,
  normalizeDefinitionForRegistry,
  normalizeDefinitionForTaskExposure,
  applyDefinitionForProjection
} from "../src/modules/profile/application/model-normalizer.js";
import type { JsonObject } from "../src/modules/profile/domain/profile-types.js";

// ---------------------------------------------------------------------------
// splitModelRef
// ---------------------------------------------------------------------------
describe("splitModelRef", () => {
  it("splits provider/model format correctly", () => {
    const result = splitModelRef("openai/gpt-5.3-codex");
    expect(result).toEqual({
      provider: "openai",
      modelId: "gpt-5.3-codex",
      hasProvider: true
    });
  });

  it("splits deeply nested provider/model format", () => {
    const result = splitModelRef("google-vertex/gemini-3.1-pro-preview");
    expect(result).toEqual({
      provider: "google-vertex",
      modelId: "gemini-3.1-pro-preview",
      hasProvider: true
    });
  });

  it("handles model with no slash", () => {
    const result = splitModelRef("gpt-5.3-codex");
    expect(result).toEqual({
      provider: "",
      modelId: "gpt-5.3-codex",
      hasProvider: false
    });
  });

  it("handles empty string", () => {
    const result = splitModelRef("");
    expect(result).toEqual({
      provider: "",
      modelId: "",
      hasProvider: false
    });
  });

  it("handles model with multiple slashes (takes first slash)", () => {
    const result = splitModelRef("provider/model/variant");
    expect(result).toEqual({
      provider: "provider",
      modelId: "model/variant",
      hasProvider: true
    });
  });

  it("handles leading slash", () => {
    const result = splitModelRef("/model-only");
    expect(result).toEqual({
      provider: "",
      modelId: "model-only",
      hasProvider: true
    });
  });
});

// ---------------------------------------------------------------------------
// joinModelRef
// ---------------------------------------------------------------------------
describe("joinModelRef", () => {
  it("joins provider and model when hasProvider is true", () => {
    expect(joinModelRef("openai", "gpt-5.3-codex", true)).toBe(
      "openai/gpt-5.3-codex"
    );
  });

  it("returns modelId only when hasProvider is false", () => {
    expect(joinModelRef("", "gpt-5.3-codex", false)).toBe("gpt-5.3-codex");
  });

  it("returns provider/ prefix even with empty modelId when hasProvider is true", () => {
    expect(joinModelRef("openai", "", true)).toBe("openai/");
  });

  it("returns empty string for all-empty args with hasProvider false", () => {
    expect(joinModelRef("", "", false)).toBe("");
  });

  it("round-trips with splitModelRef for provider/model format", () => {
    const original = "anthropic/claude-opus-4-6";
    const { provider, modelId, hasProvider } = splitModelRef(original);
    expect(joinModelRef(provider, modelId, hasProvider)).toBe(original);
  });

  it("round-trips with splitModelRef for bare model format", () => {
    const original = "gpt-5.3-codex";
    const { provider, modelId, hasProvider } = splitModelRef(original);
    expect(joinModelRef(provider, modelId, hasProvider)).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// inferPoolFromModelId
// ---------------------------------------------------------------------------
describe("inferPoolFromModelId", () => {
  it("returns 'software' for -pool-soft suffix", () => {
    expect(inferPoolFromModelId("gpt-5.3-codex-pool-soft")).toBe("software");
  });

  it("returns 'default' for -pool-default suffix", () => {
    expect(inferPoolFromModelId("gpt-5.3-codex-pool-default")).toBe("default");
  });

  it("returns 'software' for legacy -soft suffix", () => {
    expect(inferPoolFromModelId("gpt-5.3-codex-soft")).toBe("software");
  });

  it("returns 'default' for legacy -default suffix", () => {
    expect(inferPoolFromModelId("gpt-5.3-codex-default")).toBe("default");
  });

  it("returns null for model without pool suffix", () => {
    expect(inferPoolFromModelId("gpt-5.3-codex")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(inferPoolFromModelId("")).toBeNull();
  });

  it("prefers -pool-soft over legacy -soft when both could match", () => {
    // -pool-soft is checked first, so a model ending in -pool-soft should match that
    expect(inferPoolFromModelId("model-pool-soft")).toBe("software");
  });

  it("prefers -pool-default over legacy -default", () => {
    expect(inferPoolFromModelId("model-pool-default")).toBe("default");
  });

  it("returns null for non-matching suffix", () => {
    expect(inferPoolFromModelId("gpt-5.3-codex-high")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// stripPoolSuffixFromModelId
// ---------------------------------------------------------------------------
describe("stripPoolSuffixFromModelId", () => {
  it("strips -pool-soft suffix", () => {
    expect(stripPoolSuffixFromModelId("gpt-5.3-codex-pool-soft")).toBe(
      "gpt-5.3-codex"
    );
  });

  it("strips -pool-default suffix", () => {
    expect(stripPoolSuffixFromModelId("gpt-5.3-codex-low-pool-default")).toBe(
      "gpt-5.3-codex-low"
    );
  });

  it("strips legacy -soft suffix", () => {
    expect(stripPoolSuffixFromModelId("gpt-5.3-codex-soft")).toBe("gpt-5.3-codex");
  });

  it("strips legacy -default suffix", () => {
    expect(stripPoolSuffixFromModelId("gpt-5.3-codex-low-default")).toBe(
      "gpt-5.3-codex-low"
    );
  });

  it("returns model unchanged when no pool suffix", () => {
    expect(stripPoolSuffixFromModelId("gpt-5.3-codex")).toBe("gpt-5.3-codex");
  });

  it("returns empty string for empty input", () => {
    expect(stripPoolSuffixFromModelId("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// stripTaskReasoningSuffixFromModelId
// ---------------------------------------------------------------------------
describe("stripTaskReasoningSuffixFromModelId", () => {
  it("strips -high suffix", () => {
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex-high")).toBe(
      "gpt-5.3-codex"
    );
  });

  it("strips -medium suffix", () => {
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex-medium")).toBe(
      "gpt-5.3-codex"
    );
  });

  it("strips -low suffix", () => {
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex-low")).toBe(
      "gpt-5.3-codex"
    );
  });

  it("strips -extra-high suffix", () => {
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex-extra-high")).toBe(
      "gpt-5.3-codex"
    );
  });

  it("strips -extra_high suffix (underscore variant)", () => {
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex-extra_high")).toBe(
      "gpt-5.3-codex"
    );
  });

  it("is case-insensitive", () => {
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex-HIGH")).toBe(
      "gpt-5.3-codex"
    );
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex-Medium")).toBe(
      "gpt-5.3-codex"
    );
  });

  it("returns unchanged if no reasoning suffix", () => {
    expect(stripTaskReasoningSuffixFromModelId("gpt-5.3-codex")).toBe("gpt-5.3-codex");
  });

  it("returns empty string for empty input", () => {
    expect(stripTaskReasoningSuffixFromModelId("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeDefinitionForRegistry
// ---------------------------------------------------------------------------
describe("normalizeDefinitionForRegistry", () => {
  it("strips pool suffix from openai codex model and infers keyPool", () => {
    const result = normalizeDefinitionForRegistry({
      model: "openai/gpt-5.3-codex-pool-soft"
    });
    expect(result.definition.model).toBe("openai/gpt-5.3-codex");
    expect(result.inferredKeyPool).toBe("software");
  });

  it("infers 'any' for openai codex model without pool suffix", () => {
    const result = normalizeDefinitionForRegistry({
      model: "openai/gpt-5.3-codex"
    });
    expect(result.definition.model).toBe("openai/gpt-5.3-codex");
    expect(result.inferredKeyPool).toBe("any");
  });

  it("returns 'any' for non-openai models", () => {
    const result = normalizeDefinitionForRegistry({
      model: "anthropic/claude-sonnet-4-6"
    });
    expect(result.definition.model).toBe("anthropic/claude-sonnet-4-6");
    expect(result.inferredKeyPool).toBe("any");
  });

  it("returns 'any' when model field is missing", () => {
    const result = normalizeDefinitionForRegistry({ name: "agent" });
    expect(result.inferredKeyPool).toBe("any");
    expect(result.definition.model).toBeUndefined();
  });

  it("returns 'any' when model field is not a string", () => {
    const result = normalizeDefinitionForRegistry({ model: 123 });
    expect(result.inferredKeyPool).toBe("any");
  });

  it("does not mutate the original definition", () => {
    const original: JsonObject = { model: "openai/gpt-5.3-codex-pool-soft" };
    normalizeDefinitionForRegistry(original);
    expect(original.model).toBe("openai/gpt-5.3-codex-pool-soft");
  });

  it("handles non-openai provider with codex-like name as 'any'", () => {
    const result = normalizeDefinitionForRegistry({
      model: "custom-provider/codex-variant"
    });
    expect(result.inferredKeyPool).toBe("any");
  });

  it("strips legacy -default suffix and infers 'default'", () => {
    const result = normalizeDefinitionForRegistry({
      model: "openai/gpt-5.3-codex-low-default"
    });
    expect(result.definition.model).toBe("openai/gpt-5.3-codex-low");
    expect(result.inferredKeyPool).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// normalizeDefinitionForTaskExposure
// ---------------------------------------------------------------------------
describe("normalizeDefinitionForTaskExposure", () => {
  it("returns definition unchanged when taskExposure is 'off'", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex-high-pool-soft" };
    const result = normalizeDefinitionForTaskExposure(def, "off");
    expect(result.model).toBe("openai/gpt-5.3-codex-high-pool-soft");
  });

  it("strips pool and reasoning suffixes for 'direct' codex model", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex-high-pool-soft" };
    const result = normalizeDefinitionForTaskExposure(def, "direct");
    expect(result.model).toBe("openai/gpt-5.3-codex");
  });

  it("strips pool and reasoning suffixes for 'alias' codex model", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex-medium-pool-default" };
    const result = normalizeDefinitionForTaskExposure(def, "alias");
    expect(result.model).toBe("openai/gpt-5.3-codex");
  });

  it("leaves non-codex model unchanged for direct exposure", () => {
    const def: JsonObject = { model: "anthropic/claude-sonnet-4-6" };
    const result = normalizeDefinitionForTaskExposure(def, "direct");
    expect(result.model).toBe("anthropic/claude-sonnet-4-6");
  });

  it("leaves model unchanged when model is not a string", () => {
    const def: JsonObject = { model: 42 };
    const result = normalizeDefinitionForTaskExposure(def, "direct");
    expect(result.model).toBe(42);
  });

  it("does not mutate the original definition", () => {
    const original: JsonObject = { model: "openai/gpt-5.3-codex-high" };
    normalizeDefinitionForTaskExposure(original, "direct");
    expect(original.model).toBe("openai/gpt-5.3-codex-high");
  });
});

// ---------------------------------------------------------------------------
// applyDefinitionForProjection
// ---------------------------------------------------------------------------
describe("applyDefinitionForProjection", () => {
  it("appends -pool-soft for codex model with software pool and task off", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex" };
    const result = applyDefinitionForProjection(def, "software", "off");
    expect(result.model).toBe("openai/gpt-5.3-codex-pool-soft");
  });

  it("appends -pool-default for codex model with default pool and task off", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex-low" };
    const result = applyDefinitionForProjection(def, "default", "off");
    expect(result.model).toBe("openai/gpt-5.3-codex-low-pool-default");
  });

  it("does not append suffix for codex model with 'any' pool and task off", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex" };
    const result = applyDefinitionForProjection(def, "any", "off");
    expect(result.model).toBe("openai/gpt-5.3-codex");
  });

  it("does not append pool suffix when task exposure is 'direct'", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex" };
    const result = applyDefinitionForProjection(def, "software", "direct");
    expect(result.model).toBe("openai/gpt-5.3-codex");
  });

  it("does not append pool suffix when task exposure is 'alias'", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex-low" };
    const result = applyDefinitionForProjection(def, "default", "alias");
    expect(result.model).toBe("openai/gpt-5.3-codex");
  });

  it("leaves non-openai model unchanged regardless of pool/task", () => {
    const def: JsonObject = { model: "anthropic/claude-sonnet-4-6" };
    const result = applyDefinitionForProjection(def, "software", "off");
    expect(result.model).toBe("anthropic/claude-sonnet-4-6");
  });

  it("leaves definition unchanged when model is not a string", () => {
    const def: JsonObject = { model: null };
    const result = applyDefinitionForProjection(def, "software", "off");
    expect(result.model).toBeNull();
  });

  it("strips reasoning suffix for task-exposed codex model before projecting", () => {
    const def: JsonObject = { model: "openai/gpt-5.3-codex-medium" };
    const result = applyDefinitionForProjection(def, "software", "direct");
    expect(result.model).toBe("openai/gpt-5.3-codex");
  });

  it("does not mutate the original definition", () => {
    const original: JsonObject = { model: "openai/gpt-5.3-codex" };
    applyDefinitionForProjection(original, "software", "off");
    expect(original.model).toBe("openai/gpt-5.3-codex");
  });
});
