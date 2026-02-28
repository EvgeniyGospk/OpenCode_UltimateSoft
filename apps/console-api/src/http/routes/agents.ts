import type { FastifyInstance, FastifyRequest } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import { ProfileServiceError } from "../../modules/profile/domain/errors.js";
import type { IAgentService } from "../../modules/profile/domain/service-interfaces.js";
import type { AgentKeyPool } from "../../modules/profile/domain/profile-types.js";
import {
  parseUpdateBody,
  requireJsonBody,
  requireStringField
} from "../../utils/validation.js";
import { isValidKeyPool } from "../../modules/profile/application/validation-helpers.js";

function parseOptionalKeyPool(value: unknown): AgentKeyPool | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isValidKeyPool(value)) {
    return value;
  }

  throw new ProfileServiceError(
    "INVALID_BODY",
    "Field 'keyPool' must be one of: any, software, default.",
    400
  );
}

function parseCreateBody(body: unknown) {
  const obj = requireJsonBody(body);
  const key = requireStringField(obj.key, "key");
  const { definition } = parseUpdateBody(body);
  const keyPool = parseOptionalKeyPool(obj.keyPool);

  return { key, definition, keyPool };
}

function parseAgentUpdateBody(body: unknown) {
  const { definition, raw } = parseUpdateBody(body);
  return {
    definition,
    keyPool: parseOptionalKeyPool(raw.keyPool)
  };
}

function parseRenameBody(body: unknown) {
  const obj = requireJsonBody(body);
  const key = requireStringField(obj.key, "key");
  return { key };
}

export async function registerAgentRoutes(
  app: FastifyInstance,
  profileService: IAgentService
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
        const payload = parseAgentUpdateBody(request.body);
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
