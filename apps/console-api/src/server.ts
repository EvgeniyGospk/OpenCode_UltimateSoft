import Fastify, { type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { resolveCorrelationContext } from "./http/correlation.js";
import { registerAgentRoutes } from "./http/routes/agents.js";
import { registerBackupRoutes } from "./http/routes/backups.js";
import { registerHealthRoute } from "./http/routes/health.js";
import { registerProfileRoutes } from "./http/routes/profiles.js";
import { registerProviderRoutes } from "./http/routes/providers.js";
import { createProfileService } from "./modules/profile/application/composition.js";

export function buildServer(options: FastifyServerOptions = {}) {
  const profileService = createProfileService();
  const app = Fastify({
    logger: true,
    disableRequestLogging: false,
    ...options
  });

  app.addHook("onRequest", async (request, reply) => {
    const correlation = resolveCorrelationContext(request.headers);
    request.correlation = correlation;

    reply.header("x-request-id", correlation.requestId);
    reply.header("x-trace-id", correlation.traceId);
  });

  app.addHook("preHandler", async (request, reply) => {
    request.log = request.log.child({
      requestId: request.correlation.requestId,
      traceId: request.correlation.traceId
    });

    reply.header("x-service-name", "console-api");
  });

  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Content-Type", "Authorization", "X-Request-Id", "X-Trace-Id"]
  });

  app.register(registerHealthRoute);
  app.register((instance) => registerProfileRoutes(instance, profileService));
  app.register((instance) => registerAgentRoutes(instance, profileService));
  app.register((instance) => registerProviderRoutes(instance, profileService));
  app.register((instance) => registerBackupRoutes(instance, profileService));

  app.addHook("onReady", async () => {
    try {
      await profileService.ensureAgentRegistryInitialized();
    } catch (error) {
      app.log.warn({ err: error }, "agent registry initialization skipped");
    }
  });

  return app;
}
