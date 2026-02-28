import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import {
  ProfileService,
  ProfileServiceError
} from "../../modules/profile/application/profile-service.js";
import { isJsonObject } from "../../utils/validation.js";

function parseUpdateBody(body: unknown) {
  if (!isJsonObject(body) || !isJsonObject(body.definition)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'definition' must be a JSON object.",
      400
    );
  }

  return {
    definition: body.definition
  };
}

export async function registerProviderRoutes(
  app: FastifyInstance,
  profileService: ProfileService
) {
  app.get(
    "/api/v1/providers",
    wrapRoute(app, async (request, reply) => {
      const providers = await profileService.listProviders();
      return sendData(reply, request, 200, { items: providers });
    })
  );

  app.put(
    "/api/v1/providers/:providerKey",
    wrapRoute<FastifyRequest<{ Params: { providerKey: string } }>>(
      app,
      async (request, reply) => {
        const payload = parseUpdateBody(request.body);
        const result = await profileService.updateProvider(
          request.params.providerKey,
          payload.definition
        );
        return sendData(reply, request, 200, result);
      }
    )
  );
}
