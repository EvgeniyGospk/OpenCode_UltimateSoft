import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";

let app: ReturnType<typeof buildServer> | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe("CORS preflight", () => {
  it("allows PUT and DELETE for browser preflight requests", async () => {
    app = buildServer({ logger: false, jobsDbPath: ":memory:" });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/agents/test-agent",
      headers: {
        origin: "http://127.0.0.1:5174",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:5174"
    );

    const allowedMethodsHeader =
      response.headers["access-control-allow-methods"] ?? "";
    const allowedMethods = allowedMethodsHeader
      .split(",")
      .map((value) => value.trim().toUpperCase());

    expect(allowedMethods).toContain("PUT");
    expect(allowedMethods).toContain("DELETE");
  });
});
