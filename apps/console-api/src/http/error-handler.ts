import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "./envelope.js";

/**
 * Shape expected from any service-layer error that the HTTP layer can map
 * to a structured API response.  Using duck-typing (instead of
 * `instanceof`) means new error classes in other modules automatically
 * work without modifying this handler — they just need to expose the
 * same `code`, `statusCode`, and optional `details` properties.
 */
interface ServiceError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

function isServiceError(error: unknown): error is ServiceError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.statusCode === "number"
  );
}

/**
 * Centralized error handler for all API routes.
 *
 * Error mapping strategy:
 *  1. If the error duck-types as a ServiceError (has `code`, `message`,
 *     and `statusCode`), we forward those values directly to the client.
 *     This covers `ProfileServiceError` and any future service errors
 *     that follow the same shape.
 *  2. Anything else is treated as an unexpected failure and logged at
 *     error level; the client receives a generic 500 response.
 */
export function respondWithError(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown
) {
  if (isServiceError(error)) {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      app.log.warn(
        { code: error.code, statusCode: error.statusCode, details: error.details },
        error.message
      );
    } else {
      app.log.error(
        { code: error.code, statusCode: error.statusCode, details: error.details },
        error.message
      );
    }

    return sendError(reply, request, error.statusCode, {
      code: error.code,
      message: error.message,
      details: error.details
    });
  }

  app.log.error({ err: error }, "route handler failed");
  return sendError(reply, request, 500, {
    code: "INTERNAL_ERROR",
    message: "Internal server error."
  });
}

/**
 * Higher-order function that wraps a route handler with
 * try/catch and the standard error response.
 *
 * Usage:
 * ```
 * app.get("/path", wrapRoute(app, async (request, reply) => {
 *   return sendData(reply, request, 200, { ok: true });
 * }));
 * ```
 */
export function wrapRoute<
  Req extends FastifyRequest = FastifyRequest,
  Rep extends FastifyReply = FastifyReply
>(
  app: FastifyInstance,
  handler: (request: Req, reply: Rep) => Promise<unknown>
) {
  return async (request: Req, reply: Rep) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      return respondWithError(
        app,
        request as FastifyRequest,
        reply as FastifyReply,
        error
      );
    }
  };
}
