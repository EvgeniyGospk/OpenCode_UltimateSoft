import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import { ProfileService } from "../../modules/profile/application/profile-service.js";

export async function registerBackupRoutes(
  app: FastifyInstance,
  profileService: ProfileService
) {
  app.get(
    "/api/v1/backups",
    wrapRoute(app, async (request, reply) => {
      const backups = await profileService.listBackups();
      return sendData(reply, request, 200, { items: backups });
    })
  );

  app.post(
    "/api/v1/backups/restore/:snapshotId",
    wrapRoute<FastifyRequest<{ Params: { snapshotId: string } }>>(
      app,
      async (request, reply) => {
        const result = await profileService.restoreBackup(
          request.params.snapshotId
        );
        return sendData(reply, request, 200, result);
      }
    )
  );
}
