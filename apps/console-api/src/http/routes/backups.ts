import type { FastifyInstance, FastifyRequest } from "fastify";
import { sendData } from "../envelope.js";
import { wrapRoute } from "../error-handler.js";
import type { IBackupService } from "../../modules/profile/domain/service-interfaces.js";

export async function registerBackupRoutes(
  app: FastifyInstance,
  profileService: IBackupService
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
