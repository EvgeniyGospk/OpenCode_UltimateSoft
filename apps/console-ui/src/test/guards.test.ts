import { describe, it, expect } from "vitest";
import { isJsonObject, countObjectKeys } from "@/lib/guards";

// ---------------------------------------------------------------------------
// isJsonObject
// ---------------------------------------------------------------------------

describe("isJsonObject", () => {
  it("returns true for a plain object", () => {
    expect(isJsonObject({})).toBe(true);
  });

  it("returns true for an object with keys", () => {
    expect(isJsonObject({ a: 1, b: "two" })).toBe(true);
  });

  it("returns true for a nested object", () => {
    expect(isJsonObject({ nested: { deep: true } })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isJsonObject(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isJsonObject(undefined)).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isJsonObject([1, 2, 3])).toBe(false);
  });

  it("returns false for an empty array", () => {
    expect(isJsonObject([])).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isJsonObject("hello")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isJsonObject(42)).toBe(false);
  });

  it("returns false for a boolean", () => {
    expect(isJsonObject(true)).toBe(false);
  });

  it("returns false for zero", () => {
    expect(isJsonObject(0)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isJsonObject("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// countObjectKeys
// ---------------------------------------------------------------------------

describe("countObjectKeys", () => {
  it("returns 0 for null", () => {
    expect(countObjectKeys(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(countObjectKeys(undefined)).toBe(0);
  });

  it("returns 0 for an array", () => {
    expect(countObjectKeys([1, 2, 3])).toBe(0);
  });

  it("returns 0 for a string", () => {
    expect(countObjectKeys("hello")).toBe(0);
  });

  it("returns 0 for a number", () => {
    expect(countObjectKeys(42)).toBe(0);
  });

  it("returns 0 for a boolean", () => {
    expect(countObjectKeys(false)).toBe(0);
  });

  it("returns 0 for an empty object", () => {
    expect(countObjectKeys({})).toBe(0);
  });

  it("returns the correct count for a flat object", () => {
    expect(countObjectKeys({ a: 1, b: 2, c: 3 })).toBe(3);
  });

  it("returns the correct count for a nested object (counts only top-level keys)", () => {
    expect(countObjectKeys({ a: { x: 1 }, b: { y: 2 } })).toBe(2);
  });

  it("returns 1 for a single-key object", () => {
    expect(countObjectKeys({ only: "one" })).toBe(1);
  });
});
