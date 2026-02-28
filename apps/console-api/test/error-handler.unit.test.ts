import { describe, expect, it, vi } from "vitest";
import { respondWithError, wrapRoute } from "../src/http/error-handler.js";
import { ProfileServiceError } from "../src/modules/profile/application/profile-service.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function createMockRequest(
  requestId = "req-123",
  traceId = "trace-456"
): FastifyRequest {
  return {
    correlation: { requestId, traceId }
  } as unknown as FastifyRequest;
}

function createMockReply() {
  const sent: { statusCode: number; body: unknown }[] = [];
  const reply = {
    status(code: number) {
      return {
        send(body: unknown) {
          sent.push({ statusCode: code, body });
          return body;
        }
      };
    }
  } as unknown as FastifyReply;

  return { reply, sent };
}

function createMockApp(): FastifyInstance {
  return {
    log: {
      error: vi.fn(),
      warn: vi.fn()
    }
  } as unknown as FastifyInstance;
}

describe("respondWithError", () => {
  it("maps ProfileServiceError to correct status code and envelope", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    const error = new ProfileServiceError(
      "AGENT_NOT_FOUND",
      "Agent 'foo' does not exist.",
      404,
      { key: "foo" }
    );

    respondWithError(app, request, reply, error);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.statusCode).toBe(404);
    expect(sent[0]?.body).toEqual({
      requestId: "req-123",
      traceId: "trace-456",
      data: null,
      error: {
        code: "AGENT_NOT_FOUND",
        message: "Agent 'foo' does not exist.",
        details: { key: "foo" }
      }
    });
  });

  it("maps ProfileServiceError with 400 status for validation errors", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    const error = new ProfileServiceError(
      "INVALID_KEY",
      "Invalid agent key.",
      400
    );

    respondWithError(app, request, reply, error);

    expect(sent[0]?.statusCode).toBe(400);
    expect(sent[0]?.body).toEqual({
      requestId: "req-123",
      traceId: "trace-456",
      data: null,
      error: {
        code: "INVALID_KEY",
        message: "Invalid agent key.",
        details: undefined
      }
    });
  });

  it("maps ProfileServiceError with 409 status for conflicts", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    const error = new ProfileServiceError(
      "AGENT_EXISTS",
      "Agent 'build' already exists.",
      409
    );

    respondWithError(app, request, reply, error);

    expect(sent[0]?.statusCode).toBe(409);
    const body = sent[0]?.body as { error?: { code?: string } };
    expect(body?.error?.code).toBe("AGENT_EXISTS");
  });

  it("maps unknown errors to 500 with INTERNAL_ERROR code", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    respondWithError(app, request, reply, new Error("something broke"));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.statusCode).toBe(500);
    expect(sent[0]?.body).toEqual({
      requestId: "req-123",
      traceId: "trace-456",
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error."
      }
    });
  });

  it("maps non-Error values (string) to 500", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    respondWithError(app, request, reply, "unexpected string error");

    expect(sent[0]?.statusCode).toBe(500);
    const body = sent[0]?.body as { error?: { code?: string } };
    expect(body?.error?.code).toBe("INTERNAL_ERROR");
  });

  it("logs unknown errors via app.log.error", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply } = createMockReply();
    const error = new TypeError("unexpected");

    respondWithError(app, request, reply, error);

    expect(app.log.error).toHaveBeenCalledWith(
      { err: error },
      "route handler failed"
    );
  });

  it("logs 4xx service errors at warn level", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply } = createMockReply();

    respondWithError(
      app,
      request,
      reply,
      new ProfileServiceError("EMPTY_UPDATE", "Provide at least one field.", 400)
    );

    expect(app.log.warn).toHaveBeenCalled();
    expect(app.log.error).not.toHaveBeenCalled();
  });

  it("returns envelope with data: null for all error responses", () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    respondWithError(
      app,
      request,
      reply,
      new ProfileServiceError("PROFILE_NOT_FOUND", "Not found.", 404)
    );

    const body = sent[0]?.body as { data?: unknown; error?: unknown };
    expect(body?.data).toBeNull();
    expect(body?.error).toBeDefined();
  });
});

describe("wrapRoute", () => {
  it("delegates to handler on success", async () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply } = createMockReply();

    const handler = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = wrapRoute(app, handler);
    const result = await wrapped(request, reply);

    expect(handler).toHaveBeenCalledWith(request, reply);
    expect(result).toEqual({ ok: true });
  });

  it("catches thrown ProfileServiceError and maps to structured response", async () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    const handler = vi.fn().mockRejectedValue(
      new ProfileServiceError("AGENT_NOT_FOUND", "Agent missing.", 404)
    );

    const wrapped = wrapRoute(app, handler);
    await wrapped(request, reply);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.statusCode).toBe(404);
    const body = sent[0]?.body as { error?: { code?: string } };
    expect(body?.error?.code).toBe("AGENT_NOT_FOUND");
  });

  it("catches thrown generic errors and maps to 500", async () => {
    const app = createMockApp();
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    const handler = vi.fn().mockRejectedValue(new Error("kaboom"));
    const wrapped = wrapRoute(app, handler);
    await wrapped(request, reply);

    expect(sent[0]?.statusCode).toBe(500);
    const body = sent[0]?.body as { error?: { code?: string } };
    expect(body?.error?.code).toBe("INTERNAL_ERROR");
  });

  it("preserves correlation ids in error envelope from wrapRoute", async () => {
    const app = createMockApp();
    const request = createMockRequest("custom-req", "custom-trace");
    const { reply, sent } = createMockReply();

    const handler = vi.fn().mockRejectedValue(new Error("fail"));
    const wrapped = wrapRoute(app, handler);
    await wrapped(request, reply);

    const body = sent[0]?.body as { requestId?: string; traceId?: string };
    expect(body?.requestId).toBe("custom-req");
    expect(body?.traceId).toBe("custom-trace");
  });
});
