import { describe, expect, it } from "vitest";
import { resolveCorrelationContext } from "../src/http/correlation.js";

describe("resolveCorrelationContext", () => {
  it("uses provided headers when present", () => {
    const result = resolveCorrelationContext({
      "x-request-id": "req-1",
      "x-trace-id": "trace-1"
    });

    expect(result).toEqual({ requestId: "req-1", traceId: "trace-1" });
  });

  it("generates UUID values when headers are missing", () => {
    const result = resolveCorrelationContext({});

    expect(result.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(result.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});
