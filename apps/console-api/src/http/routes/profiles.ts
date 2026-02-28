import type { FastifyInstance } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import type { IProfileCoreService } from "../../modules/profile/domain/service-interfaces.js";
import {
  requireJsonBody,
  requireOptionalJsonField,
  requireOptionalStringField
} from "../../utils/validation.js";

function extractSaveBody(request: { body: unknown }) {
  const obj = requireJsonBody(request.body);

  const opencodeJson = requireOptionalJsonField(obj.opencodeJson, "opencodeJson");
  const ohMyOpencodeJson = requireOptionalJsonField(obj.ohMyOpencodeJson, "ohMyOpencodeJson");
  const agentsMarkdown = requireOptionalStringField(obj.agentsMarkdown, "agentsMarkdown");

  return {
    opencodeJson,
    ohMyOpencodeJson,
    agentsMarkdown
  };
}

export async function registerProfileRoutes(
  app: FastifyInstance,
  profileService: IProfileCoreService
) {
  app.get(
    "/api/v1/profiles",
    wrapRoute(app, async (request, reply) => {
      const profiles = await profileService.listProfiles();
      return sendData(reply, request, 200, { items: profiles });
    })
  );

  app.get(
    "/api/v1/profiles/active",
    wrapRoute(app, async (request, reply) => {
      const profile = await profileService.getActiveProfile();
      return sendData(reply, request, 200, profile);
    })
  );

  app.put(
    "/api/v1/profiles/active",
    wrapRoute(app, async (request, reply) => {
      const payload = extractSaveBody(request);
      const result = await profileService.saveActiveProfile(payload);
      return sendData(reply, request, 200, result);
    })
  );
}
