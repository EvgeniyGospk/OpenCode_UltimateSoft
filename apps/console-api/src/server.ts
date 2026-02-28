import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import Fastify, { type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import { resolveCorrelationContext } from "./http/correlation.js";
import { registerAgentRoutes } from "./http/routes/agents.js";
import { registerBackupRoutes } from "./http/routes/backups.js";
import { registerHealthRoute } from "./http/routes/health.js";
import { registerJobRoutes } from "./http/routes/jobs.js";
import { registerProfileRoutes } from "./http/routes/profiles.js";
import { registerProviderRoutes } from "./http/routes/providers.js";
import { createProfileService } from "./modules/profile/application/composition.js";
import { JobStore } from "./modules/jobs/infra/job-store.js";
import { JobService } from "./modules/jobs/application/job-service.js";
import { SmokeWorker } from "./modules/jobs/application/job-worker.js";

export interface BuildServerOptions extends FastifyServerOptions {
  /** Override the SQLite path used by the jobs engine (default: ~/.opencode-console/jobs.db). Use ":memory:" for tests. */
  jobsDbPath?: string;
}

export function buildServer(options: BuildServerOptions = {}) {
  const { jobsDbPath: explicitDbPath, ...fastifyOptions } = options;
  const profileService = createProfileService();

  /* ---- Jobs engine ---- */
  let jobsDbPath: string;
  if (explicitDbPath) {
    jobsDbPath = explicitDbPath;
  } else {
    const jobsDbDir = join(homedir(), ".opencode-console");
    mkdirSync(jobsDbDir, { recursive: true });
    jobsDbPath = join(jobsDbDir, "jobs.db");
  }
  const jobStore = new JobStore(jobsDbPath);
  const jobService = new JobService(jobStore);
  const smokeWorker = new SmokeWorker(jobStore);

  const app = Fastify({
    logger: true,
    disableRequestLogging: false,
    ...fastifyOptions
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
  app.register((instance) => registerJobRoutes(instance, jobService, smokeWorker));

  app.addHook("onReady", async () => {
    try {
      await profileService.ensureAgentRegistryInitialized();
    } catch (error) {
      app.log.warn({ err: error }, "agent registry initialization skipped");
    }

    smokeWorker.start();
    app.log.info("smoke worker started");
  });

  app.addHook("onClose", async () => {
    smokeWorker.stop();
    jobStore.close();
  });

  return app;
}
