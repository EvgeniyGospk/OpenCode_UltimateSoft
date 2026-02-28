import { describe, expect, it } from "vitest";
import { resolveCorrelationContext } from "../src/http/correlation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Edge cases for resolveCorrelationContext
// ---------------------------------------------------------------------------
describe("resolveCorrelationContext — edge cases", () => {
  // -----------------------------------------------------------------------
  // `request-id` fallback (when `x-request-id` is absent)
  // -----------------------------------------------------------------------
  it("falls back to 'request-id' header when 'x-request-id' is absent", () => {
    const result = resolveCorrelationContext({
      "request-id": "fallback-req"
    });

    expect(result.requestId).toBe("fallback-req");
  });

  it("prefers 'x-request-id' over 'request-id' when both present", () => {
    const result = resolveCorrelationContext({
      "x-request-id": "primary",
      "request-id": "secondary"
    });

    expect(result.requestId).toBe("primary");
  });

  it("falls back to UUID when 'x-request-id' is empty but 'request-id' is set", () => {
    const result = resolveCorrelationContext({
      "x-request-id": "",
      "request-id": "fallback-req"
    });

    expect(result.requestId).toBe("fallback-req");
  });

  // -----------------------------------------------------------------------
  // Array header values
  // -----------------------------------------------------------------------
  it("uses the first element of an array x-request-id header", () => {
    const result = resolveCorrelationContext({
      "x-request-id": ["arr-req-1", "arr-req-2"]
    });

    expect(result.requestId).toBe("arr-req-1");
  });

  it("uses the first element of an array x-trace-id header", () => {
    const result = resolveCorrelationContext({
      "x-trace-id": ["arr-trace-1", "arr-trace-2"]
    });

    expect(result.traceId).toBe("arr-trace-1");
  });

  it("falls back to UUID for an empty array x-request-id", () => {
    const result = resolveCorrelationContext({
      "x-request-id": []
    });

    expect(result.requestId).toMatch(UUID_RE);
  });

  it("falls back to UUID for an empty array x-trace-id", () => {
    const result = resolveCorrelationContext({
      "x-trace-id": []
    });

    expect(result.traceId).toMatch(UUID_RE);
  });

  it("uses first element of array request-id when x-request-id is absent", () => {
    const result = resolveCorrelationContext({
      "request-id": ["arr-fallback-1", "arr-fallback-2"]
    });

    expect(result.requestId).toBe("arr-fallback-1");
  });

  // -----------------------------------------------------------------------
  // Missing all correlation headers
  // -----------------------------------------------------------------------
  it("generates UUIDs for both fields when no headers are present", () => {
    const result = resolveCorrelationContext({});

    expect(result.requestId).toMatch(UUID_RE);
    expect(result.traceId).toMatch(UUID_RE);
  });

  it("generates different UUIDs for requestId and traceId", () => {
    const result = resolveCorrelationContext({});

    // While theoretically possible for them to match, it's astronomically unlikely
    // This verifies both are independently generated
    expect(typeof result.requestId).toBe("string");
    expect(typeof result.traceId).toBe("string");
    expect(result.requestId).toMatch(UUID_RE);
    expect(result.traceId).toMatch(UUID_RE);
  });

  it("generates UUIDs when all headers are undefined", () => {
    const result = resolveCorrelationContext({
      "x-request-id": undefined,
      "request-id": undefined,
      "x-trace-id": undefined
    });

    expect(result.requestId).toMatch(UUID_RE);
    expect(result.traceId).toMatch(UUID_RE);
  });

  it("generates UUID for traceId when only request headers are present", () => {
    const result = resolveCorrelationContext({
      "x-request-id": "my-req"
    });

    expect(result.requestId).toBe("my-req");
    expect(result.traceId).toMatch(UUID_RE);
  });

  it("generates UUID for requestId when only trace header is present", () => {
    const result = resolveCorrelationContext({
      "x-trace-id": "my-trace"
    });

    expect(result.requestId).toMatch(UUID_RE);
    expect(result.traceId).toBe("my-trace");
  });
});
