import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import {
  ProfileService,
  ProfileServiceError
} from "../../modules/profile/application/profile-service.js";
import type { AgentKeyPool } from "../../modules/profile/domain/profile-types.js";
import { isJsonObject } from "../../utils/validation.js";

function parseOptionalKeyPool(value: unknown): AgentKeyPool | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "any" || value === "software" || value === "default") {
    return value;
  }

  throw new ProfileServiceError(
    "INVALID_BODY",
    "Field 'keyPool' must be one of: any, software, default.",
    400
  );
}

function parseCreateBody(body: unknown) {
  if (!isJsonObject(body)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Request body must be a JSON object.",
      400
    );
  }

  const key = body.key;
  const definition = body.definition;
  const keyPool = parseOptionalKeyPool(body.keyPool);

  if (typeof key !== "string") {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'key' must be a string.",
      400
    );
  }

  if (!isJsonObject(definition)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'definition' must be a JSON object.",
      400
    );
  }

  return { key, definition, keyPool };
}

function parseUpdateBody(body: unknown) {
  if (!isJsonObject(body) || !isJsonObject(body.definition)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'definition' must be a JSON object.",
      400
    );
  }

  return {
    definition: body.definition,
    keyPool: parseOptionalKeyPool(body.keyPool)
  };
}

function parseRenameBody(body: unknown) {
  if (!isJsonObject(body) || typeof body.key !== "string") {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'key' must be a string.",
      400
    );
  }

  return {
    key: body.key
  };
}

export async function registerAgentRoutes(
  app: FastifyInstance,
  profileService: ProfileService
) {
  app.get(
    "/api/v1/agents",
    wrapRoute(app, async (request, reply) => {
      const agents = await profileService.listAgents();
      return sendData(reply, request, 200, { items: agents });
    })
  );

  app.get(
    "/api/v1/agents/sync-status",
    wrapRoute(app, async (request, reply) => {
      const status = await profileService.getAgentRegistrySyncStatus();
      return sendData(reply, request, 200, status);
    })
  );

  app.post(
    "/api/v1/agents/sync",
    wrapRoute(app, async (request, reply) => {
      const result = await profileService.synchronizeAgentsRegistry();
      return sendData(reply, request, 200, result);
    })
  );

  app.post(
    "/api/v1/agents",
    wrapRoute(app, async (request, reply) => {
      const payload = parseCreateBody(request.body);
      const result = await profileService.createAgent(
        payload.key,
        payload.definition,
        payload.keyPool
      );
      return sendData(reply, request, 201, result);
    })
  );

  app.put(
    "/api/v1/agents/:agentKey",
    wrapRoute<FastifyRequest<{ Params: { agentKey: string } }>>(
      app,
      async (request, reply) => {
        const payload = parseUpdateBody(request.body);
        const result = await profileService.updateAgent(
          request.params.agentKey,
          payload.definition,
          payload.keyPool
        );
        return sendData(reply, request, 200, result);
      }
    )
  );

  app.post(
    "/api/v1/agents/:agentKey/rename",
    wrapRoute<FastifyRequest<{ Params: { agentKey: string } }>>(
      app,
      async (request, reply) => {
        const payload = parseRenameBody(request.body);
        const result = await profileService.renameAgent(
          request.params.agentKey,
          payload.key
        );
        return sendData(reply, request, 200, result);
      }
    )
  );

  app.delete(
    "/api/v1/agents/:agentKey",
    wrapRoute<FastifyRequest<{ Params: { agentKey: string } }>>(
      app,
      async (request, reply) => {
        const result = await profileService.deleteAgent(
          request.params.agentKey
        );
        return sendData(reply, request, 200, result);
      }
    )
  );
}
