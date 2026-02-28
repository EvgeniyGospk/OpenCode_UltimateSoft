import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    correlation: {
      requestId: string;
      traceId: string;
    };
  }
}
