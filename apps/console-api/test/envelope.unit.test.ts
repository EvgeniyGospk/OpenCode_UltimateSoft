import { describe, expect, it } from "vitest";
import { sendData, sendError } from "../src/http/envelope.js";
import type { FastifyReply, FastifyRequest } from "fastify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(
  requestId = "req-abc",
  traceId = "trace-xyz"
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

// ---------------------------------------------------------------------------
// sendData
// ---------------------------------------------------------------------------
describe("sendData", () => {
  it("returns envelope with requestId, traceId, data, and error: null", () => {
    const request = createMockRequest("r1", "t1");
    const { reply, sent } = createMockReply();

    sendData(reply, request, 200, { items: [1, 2, 3] });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      requestId: "r1",
      traceId: "t1",
      data: { items: [1, 2, 3] },
      error: null
    });
  });

  it("sets the correct status code for 200", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendData(reply, request, 200, "ok");

    expect(sent[0]?.statusCode).toBe(200);
  });

  it("sets the correct status code for 201", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendData(reply, request, 201, { id: "new-item" });

    expect(sent[0]?.statusCode).toBe(201);
  });

  it("handles null data payload", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendData(reply, request, 200, null);

    expect(sent[0]?.body).toEqual({
      requestId: "req-abc",
      traceId: "trace-xyz",
      data: null,
      error: null
    });
  });

  it("handles complex nested data payload", () => {
    const request = createMockRequest("r2", "t2");
    const { reply, sent } = createMockReply();

    const payload = { users: [{ name: "Alice", roles: ["admin"] }], count: 1 };
    sendData(reply, request, 200, payload);

    const body = sent[0]?.body as { data: typeof payload };
    expect(body.data).toEqual(payload);
  });

  it("preserves correlation ids from the request", () => {
    const request = createMockRequest("custom-req-id", "custom-trace-id");
    const { reply, sent } = createMockReply();

    sendData(reply, request, 200, {});

    const body = sent[0]?.body as { requestId: string; traceId: string };
    expect(body.requestId).toBe("custom-req-id");
    expect(body.traceId).toBe("custom-trace-id");
  });
});

// ---------------------------------------------------------------------------
// sendError
// ---------------------------------------------------------------------------
describe("sendError", () => {
  it("returns envelope with requestId, traceId, error, and data: null", () => {
    const request = createMockRequest("r1", "t1");
    const { reply, sent } = createMockReply();

    sendError(reply, request, 400, {
      code: "INVALID_BODY",
      message: "Bad request."
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      requestId: "r1",
      traceId: "t1",
      data: null,
      error: { code: "INVALID_BODY", message: "Bad request." }
    });
  });

  it("sets the correct status code for 400", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendError(reply, request, 400, {
      code: "INVALID_BODY",
      message: "Bad request."
    });

    expect(sent[0]?.statusCode).toBe(400);
  });

  it("sets the correct status code for 500", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendError(reply, request, 500, {
      code: "INTERNAL_ERROR",
      message: "Internal server error."
    });

    expect(sent[0]?.statusCode).toBe(500);
  });

  it("sets the correct status code for 404", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendError(reply, request, 404, {
      code: "AGENT_NOT_FOUND",
      message: "Agent not found."
    });

    expect(sent[0]?.statusCode).toBe(404);
  });

  it("includes details in the error object when provided", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendError(reply, request, 422, {
      code: "VALIDATION_FAILED",
      message: "Validation failed.",
      details: { field: "name", reason: "too short" }
    });

    const body = sent[0]?.body as {
      error: { code: string; message: string; details: Record<string, unknown> };
    };
    expect(body.error.details).toEqual({ field: "name", reason: "too short" });
  });

  it("preserves correlation ids from the request", () => {
    const request = createMockRequest("err-req", "err-trace");
    const { reply, sent } = createMockReply();

    sendError(reply, request, 500, {
      code: "INTERNAL_ERROR",
      message: "fail"
    });

    const body = sent[0]?.body as { requestId: string; traceId: string };
    expect(body.requestId).toBe("err-req");
    expect(body.traceId).toBe("err-trace");
  });

  it("always sets data to null in error envelope", () => {
    const request = createMockRequest();
    const { reply, sent } = createMockReply();

    sendError(reply, request, 400, {
      code: "INVALID_KEY",
      message: "Bad key."
    });

    const body = sent[0]?.body as { data: unknown };
    expect(body.data).toBeNull();
  });
});
