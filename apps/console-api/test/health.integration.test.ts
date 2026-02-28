import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";

let app: ReturnType<typeof buildServer> | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe("GET /api/v1/health", () => {
  it("returns a health envelope with correlation headers", async () => {
    app = buildServer({ logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: {
        "x-request-id": "request-from-test",
        "x-trace-id": "trace-from-test"
      }
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json<{
      requestId: string;
      traceId: string;
      data: { status: string; service: string; version: string };
      error: null;
    }>();

    expect(payload.requestId).toBe("request-from-test");
    expect(payload.traceId).toBe("trace-from-test");
    expect(payload.data.status).toBe("ok");
    expect(payload.data.service).toBe("console-api");
    expect(response.headers["x-request-id"]).toBe("request-from-test");
    expect(response.headers["x-trace-id"]).toBe("trace-from-test");
  });
});
