import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "./envelope.js";
import { ProfileServiceError } from "../modules/profile/application/profile-service.js";

/**
 * Centralized error handler for all API routes.
 *
 * Maps known service errors to structured API responses and
 * falls back to a generic 500 for anything unexpected.
 */
export function respondWithError(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown
) {
  if (error instanceof ProfileServiceError) {
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
