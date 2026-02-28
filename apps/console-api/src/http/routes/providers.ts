import type { FastifyInstance, FastifyRequest } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import type { IProviderService } from "../../modules/profile/domain/service-interfaces.js";
import { parseUpdateBody } from "../../utils/validation.js";

export async function registerProviderRoutes(
  app: FastifyInstance,
  profileService: IProviderService
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
        const { definition } = parseUpdateBody(request.body);
        const result = await profileService.updateProvider(
          request.params.providerKey,
          definition
        );
        return sendData(reply, request, 200, result);
      }
    )
  );
}
