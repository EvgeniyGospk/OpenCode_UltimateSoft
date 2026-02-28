import { createProfileService } from "../modules/profile/application/profile-service.js";

async function main() {
  const profileService = createProfileService();
  const result = await profileService.synchronizeAgentsRegistry();
  const status = await profileService.getAgentRegistrySyncStatus();

  process.stdout.write(
    `${JSON.stringify(
      {
        profilePath: result.profile.path,
        snapshotId: result.snapshot.id,
        inSync: status.inSync,
        registryExists: status.registryExists,
        issues: status.issues
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify(
      {
        error: error instanceof Error ? error.message : "unknown error"
      },
      null,
      2
    )}\n`
  );
  process.exit(1);
});
