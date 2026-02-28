import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// We mock the infra layer so `createProfileService` doesn't touch the file
// system. We only care that the composition root wires things together and
// returns an object that implements the expected interface.
// ---------------------------------------------------------------------------

vi.mock("../src/modules/profile/infra/profile-store.js", () => {
  return {
    ProfileStore: class MockProfileStore {
      getManagedPaths() {
        return {};
      }
      resolveActiveProfilePath() {
        return Promise.resolve("/mock/path");
      }
      loadActiveProfile() {
        return Promise.resolve({
          id: "mock",
          name: "mock",
          path: "/mock",
          isActive: true,
          updatedAt: new Date().toISOString(),
          opencodeJson: {},
          ohMyOpencodeJson: {},
          agentsMarkdown: "",
          agentPrompts: {}
        });
      }
      listProfiles() {
        return Promise.resolve([]);
      }
      readAgentRegistry() {
        return Promise.resolve(null);
      }
      saveOpencodeJson() {
        return Promise.resolve();
      }
      saveOhMyOpencodeJson() {
        return Promise.resolve();
      }
      saveAgentsMarkdown() {
        return Promise.resolve();
      }
      saveAgentRegistry() {
        return Promise.resolve();
      }
    }
  };
});

vi.mock("../src/modules/profile/infra/snapshot-store.js", () => {
  return {
    ProfileSnapshotStore: class MockSnapshotStore {
      constructor() {}
      createSnapshot() {
        return Promise.resolve({
          id: "snap-1",
          profilePath: "/mock",
          createdAt: new Date().toISOString(),
          reason: "test",
          relativePaths: []
        });
      }
      listSnapshots() {
        return Promise.resolve([]);
      }
      restoreSnapshot() {
        return Promise.resolve();
      }
    }
  };
});

import { createProfileService } from "../src/modules/profile/application/composition.js";

// ---------------------------------------------------------------------------
// createProfileService
// ---------------------------------------------------------------------------
describe("createProfileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not throw on instantiation", () => {
    expect(() => createProfileService()).not.toThrow();
  });

  it("returns a non-null object", () => {
    const service = createProfileService();
    expect(service).toBeDefined();
    expect(typeof service).toBe("object");
  });

  // -----------------------------------------------------------------------
  // IAgentService methods
  // -----------------------------------------------------------------------
  it("exposes listAgents method", () => {
    const service = createProfileService();
    expect(typeof service.listAgents).toBe("function");
  });

  it("exposes createAgent method", () => {
    const service = createProfileService();
    expect(typeof service.createAgent).toBe("function");
  });

  it("exposes updateAgent method", () => {
    const service = createProfileService();
    expect(typeof service.updateAgent).toBe("function");
  });

  it("exposes deleteAgent method", () => {
    const service = createProfileService();
    expect(typeof service.deleteAgent).toBe("function");
  });

  it("exposes renameAgent method", () => {
    const service = createProfileService();
    expect(typeof service.renameAgent).toBe("function");
  });

  it("exposes getAgentRegistrySyncStatus method", () => {
    const service = createProfileService();
    expect(typeof service.getAgentRegistrySyncStatus).toBe("function");
  });

  it("exposes synchronizeAgentsRegistry method", () => {
    const service = createProfileService();
    expect(typeof service.synchronizeAgentsRegistry).toBe("function");
  });

  // -----------------------------------------------------------------------
  // IProviderService methods
  // -----------------------------------------------------------------------
  it("exposes listProviders method", () => {
    const service = createProfileService();
    expect(typeof service.listProviders).toBe("function");
  });

  it("exposes updateProvider method", () => {
    const service = createProfileService();
    expect(typeof service.updateProvider).toBe("function");
  });

  // -----------------------------------------------------------------------
  // IBackupService methods
  // -----------------------------------------------------------------------
  it("exposes listBackups method", () => {
    const service = createProfileService();
    expect(typeof service.listBackups).toBe("function");
  });

  it("exposes restoreBackup method", () => {
    const service = createProfileService();
    expect(typeof service.restoreBackup).toBe("function");
  });

  // -----------------------------------------------------------------------
  // IProfileCoreService methods
  // -----------------------------------------------------------------------
  it("exposes listProfiles method", () => {
    const service = createProfileService();
    expect(typeof service.listProfiles).toBe("function");
  });

  it("exposes getActiveProfile method", () => {
    const service = createProfileService();
    expect(typeof service.getActiveProfile).toBe("function");
  });

  it("exposes saveActiveProfile method", () => {
    const service = createProfileService();
    expect(typeof service.saveActiveProfile).toBe("function");
  });

  it("exposes ensureAgentRegistryInitialized method", () => {
    const service = createProfileService();
    expect(typeof service.ensureAgentRegistryInitialized).toBe("function");
  });

  // -----------------------------------------------------------------------
  // Verify each call returns a new instance
  // -----------------------------------------------------------------------
  it("creates a fresh service instance on each call", () => {
    const a = createProfileService();
    const b = createProfileService();
    expect(a).not.toBe(b);
  });
});
