import type { FastifyInstance } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import {
  ProfileService,
  ProfileServiceError
} from "../../modules/profile/application/profile-service.js";
import { isJsonObject } from "../../utils/validation.js";

function extractSaveBody(request: { body: unknown }) {
  if (!isJsonObject(request.body)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Request body must be a JSON object.",
      400
    );
  }

  const opencodeJson = request.body.opencodeJson;
  const ohMyOpencodeJson = request.body.ohMyOpencodeJson;
  const agentsMarkdown = request.body.agentsMarkdown;

  if (opencodeJson !== undefined && !isJsonObject(opencodeJson)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'opencodeJson' must be a JSON object.",
      400
    );
  }

  if (ohMyOpencodeJson !== undefined && !isJsonObject(ohMyOpencodeJson)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'ohMyOpencodeJson' must be a JSON object.",
      400
    );
  }

  if (agentsMarkdown !== undefined && typeof agentsMarkdown !== "string") {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'agentsMarkdown' must be a string.",
      400
    );
  }

  return {
    opencodeJson,
    ohMyOpencodeJson,
    agentsMarkdown
  };
}

export async function registerProfileRoutes(
  app: FastifyInstance,
  profileService: ProfileService
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
