import { ProfileStore } from "../infra/profile-store.js";
import { ProfileSnapshotStore } from "../infra/snapshot-store.js";
import { AgentService } from "./agent-service.js";
import { ProviderService } from "./provider-service.js";
import { BackupService } from "./backup-service.js";
import { ProfileCoreService } from "./profile-service.js";
import type {
  IAgentService,
  IProviderService,
  IBackupService,
  IProfileCoreService
} from "../domain/service-interfaces.js";

export interface ProfileServices {
  agentService: IAgentService;
  providerService: IProviderService;
  backupService: IBackupService;
  profileService: IProfileCoreService;
}

/**
 * Composition root for the profile module.
 * Wires concrete infra implementations into the focused service classes.
 *
 * Prefer this over the deprecated `createProfileService()` shim.
 */
export function createServices(): ProfileServices {
  const profileStore = new ProfileStore();
  const snapshotStore = new ProfileSnapshotStore(profileStore);

  const agentService = new AgentService(profileStore, snapshotStore);
  const providerService = new ProviderService(profileStore, snapshotStore);
  const backupService = new BackupService(profileStore, snapshotStore);
  const profileService = new ProfileCoreService(
    profileStore,
    snapshotStore,
    agentService
  );

  return { agentService, providerService, backupService, profileService };
}

/**
 * @deprecated Use `createServices()` instead.
 *
 * Returns a backward-compatible façade that satisfies all four service
 * interfaces by delegating to the individual focused services. Kept
 * for callers that still expect a single monolithic object
 * (e.g. `server.ts`, `sync-agent-registry.ts`).
 */
export function createProfileService(): IAgentService &
  IProviderService &
  IBackupService &
  IProfileCoreService {
  const { agentService, providerService, backupService, profileService } =
    createServices();

  return {
    // IAgentService
    ensureAgentRegistryInitialized: agentService.ensureAgentRegistryInitialized.bind(agentService),
    listAgents: agentService.listAgents.bind(agentService),
    createAgent: agentService.createAgent.bind(agentService),
    updateAgent: agentService.updateAgent.bind(agentService),
    deleteAgent: agentService.deleteAgent.bind(agentService),
    renameAgent: agentService.renameAgent.bind(agentService),
    getAgentRegistrySyncStatus: agentService.getAgentRegistrySyncStatus.bind(agentService),
    synchronizeAgentsRegistry: agentService.synchronizeAgentsRegistry.bind(agentService),

    // IProviderService
    listProviders: providerService.listProviders.bind(providerService),
    updateProvider: providerService.updateProvider.bind(providerService),

    // IBackupService
    listBackups: backupService.listBackups.bind(backupService),
    restoreBackup: backupService.restoreBackup.bind(backupService),

    // IProfileCoreService
    listProfiles: profileService.listProfiles.bind(profileService),
    getActiveProfile: profileService.getActiveProfile.bind(profileService),
    saveActiveProfile: profileService.saveActiveProfile.bind(profileService)
  };
}
