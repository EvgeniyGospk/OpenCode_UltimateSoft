import type { FastifyInstance, FastifyRequest } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import type { IJobService } from "../../modules/jobs/domain/service-interfaces.js";
import type { SmokeWorker } from "../../modules/jobs/application/job-worker.js";
import { JobServiceError } from "../../modules/jobs/domain/errors.js";

function requireJsonBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new JobServiceError("INVALID_BODY", "Request body must be a JSON object.", 400);
  }
  return body as Record<string, unknown>;
}

function requireStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new JobServiceError(
      "INVALID_BODY",
      `Field '${fieldName}' must be a non-empty string.`,
      400
    );
  }
  return value;
}

export async function registerJobRoutes(
  app: FastifyInstance,
  jobService: IJobService,
  worker: SmokeWorker
) {
  /* ---- list all jobs ---- */
  app.get(
    "/api/v1/jobs",
    wrapRoute(app, async (request, reply) => {
      const jobs = jobService.listJobs();
      return sendData(reply, request, 200, { items: jobs });
    })
  );

  /* ---- create a job ---- */
  app.post(
    "/api/v1/jobs",
    wrapRoute(app, async (request, reply) => {
      const obj = requireJsonBody(request.body);
      const type = requireStringField(obj.type, "type");
      const agentKey = requireStringField(obj.agentKey, "agentKey");
      const prompt = requireStringField(obj.prompt, "prompt");

      if (type !== "smoke") {
        throw new JobServiceError("INVALID_BODY", "Field 'type' must be one of: smoke.", 400);
      }

      const job = jobService.createJob({ type, agentKey, prompt });
      return sendData(reply, request, 201, job);
    })
  );

  /* ---- get single job ---- */
  app.get(
    "/api/v1/jobs/:jobId",
    wrapRoute<FastifyRequest<{ Params: { jobId: string } }>>(
      app,
      async (request, reply) => {
        const job = jobService.getJob(request.params.jobId);
        return sendData(reply, request, 200, job);
      }
    )
  );

  /* ---- get job logs ---- */
  app.get(
    "/api/v1/jobs/:jobId/logs",
    wrapRoute<FastifyRequest<{ Params: { jobId: string } }>>(
      app,
      async (request, reply) => {
        const logs = jobService.getJobLogs(request.params.jobId);
        return sendData(reply, request, 200, { items: logs });
      }
    )
  );

  /* ---- cancel a job ---- */
  app.post(
    "/api/v1/jobs/:jobId/cancel",
    wrapRoute<FastifyRequest<{ Params: { jobId: string } }>>(
      app,
      async (request, reply) => {
        const job = jobService.cancelJob(request.params.jobId);
        // Attempt to kill the worker process if running
        worker.killJob(request.params.jobId);
        return sendData(reply, request, 200, job);
      }
    )
  );

  /* ---- retry a job ---- */
  app.post(
    "/api/v1/jobs/:jobId/retry",
    wrapRoute<FastifyRequest<{ Params: { jobId: string } }>>(
      app,
      async (request, reply) => {
        const job = jobService.retryJob(request.params.jobId);
        return sendData(reply, request, 201, job);
      }
    )
  );
}
