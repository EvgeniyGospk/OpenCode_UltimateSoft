import type { FastifyReply, FastifyRequest } from "fastify";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function sendData<TData>(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  data: TData
) {
  return reply.status(statusCode).send({
    requestId: request.correlation.requestId,
    traceId: request.correlation.traceId,
    data,
    error: null
  });
}

export function sendError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  error: ApiError
) {
  return reply.status(statusCode).send({
    requestId: request.correlation.requestId,
    traceId: request.correlation.traceId,
    data: null,
    error
  });
}

