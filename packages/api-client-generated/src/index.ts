import type { components, paths } from "./generated/schema.js";

export type ApiPaths = paths;
export type HealthEnvelope =
  paths["/api/v1/health"]["get"]["responses"]["200"]["content"]["application/json"];
export type ProfilesEnvelope =
  paths["/api/v1/profiles"]["get"]["responses"]["200"]["content"]["application/json"];
export type ProfileStateEnvelope =
  paths["/api/v1/profiles/active"]["get"]["responses"]["200"]["content"]["application/json"];
export type ProfileMutationEnvelope =
  paths["/api/v1/profiles/active"]["put"]["responses"]["200"]["content"]["application/json"];
export type AgentsEnvelope =
  paths["/api/v1/agents"]["get"]["responses"]["200"]["content"]["application/json"];
export type AgentSyncStatusEnvelope =
  paths["/api/v1/agents/sync-status"]["get"]["responses"]["200"]["content"]["application/json"];
export type ProvidersEnvelope =
  paths["/api/v1/providers"]["get"]["responses"]["200"]["content"]["application/json"];
export type BackupsEnvelope =
  paths["/api/v1/backups"]["get"]["responses"]["200"]["content"]["application/json"];

export type SaveActiveProfileRequest = components["schemas"]["SaveActiveProfileRequest"];
export type CreateAgentRequest = components["schemas"]["CreateAgentRequest"];
export type UpdateAgentRequest = components["schemas"]["UpdateAgentRequest"];
export type UpdateDefinitionRequest = components["schemas"]["UpdateDefinitionRequest"];
export type RenameAgentRequest = components["schemas"]["RenameAgentRequest"];

const ACCEPT_JSON = { Accept: "application/json" } as const;
const JSON_HEADERS = { ...ACCEPT_JSON, "Content-Type": "application/json" } as const;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  async function requestJson<T>(
    path: string,
    init: RequestInit,
    failureContext: string
  ): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, init);

    if (!response.ok) {
      throw new Error(
        `${failureContext} failed with status ${response.status}`
      );
    }

    return (await response.json()) as T;
  }

  return {
    async getHealth(): Promise<HealthEnvelope> {
      return requestJson<HealthEnvelope>(
        "/api/v1/health",
        {
          method: "GET",
          headers: ACCEPT_JSON
        },
        "Health request"
      );
    },
    async listProfiles(): Promise<ProfilesEnvelope> {
      return requestJson<ProfilesEnvelope>(
        "/api/v1/profiles",
        {
          method: "GET",
          headers: ACCEPT_JSON
        },
        "Profiles request"
      );
    },
    async getActiveProfile(): Promise<ProfileStateEnvelope> {
      return requestJson<ProfileStateEnvelope>(
        "/api/v1/profiles/active",
        {
          method: "GET",
          headers: ACCEPT_JSON
        },
        "Active profile request"
      );
    },
    async saveActiveProfile(
      payload: SaveActiveProfileRequest
    ): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        "/api/v1/profiles/active",
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload)
        },
        "Save active profile request"
      );
    },
    async listAgents(): Promise<AgentsEnvelope> {
      return requestJson<AgentsEnvelope>(
        "/api/v1/agents",
        {
          method: "GET",
          headers: ACCEPT_JSON
        },
        "Agents request"
      );
    },
    async createAgent(payload: CreateAgentRequest): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        "/api/v1/agents",
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload)
        },
        "Create agent request"
      );
    },
    async getAgentSyncStatus(): Promise<AgentSyncStatusEnvelope> {
      return requestJson<AgentSyncStatusEnvelope>(
        "/api/v1/agents/sync-status",
        {
          method: "GET",
          headers: ACCEPT_JSON
        },
        "Agent sync status request"
      );
    },
    async synchronizeAgents(): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        "/api/v1/agents/sync",
        {
          method: "POST",
          headers: ACCEPT_JSON
        },
        "Synchronize agents request"
      );
    },
    async updateAgent(
      agentKey: string,
      payload: UpdateAgentRequest
    ): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        `/api/v1/agents/${encodeURIComponent(agentKey)}`,
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload)
        },
        "Update agent request"
      );
    },
    async deleteAgent(agentKey: string): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        `/api/v1/agents/${encodeURIComponent(agentKey)}`,
        {
          method: "DELETE",
          headers: ACCEPT_JSON
        },
        "Delete agent request"
      );
    },
    async renameAgent(
      agentKey: string,
      payload: RenameAgentRequest
    ): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        `/api/v1/agents/${encodeURIComponent(agentKey)}/rename`,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload)
        },
        "Rename agent request"
      );
    },
    async listProviders(): Promise<ProvidersEnvelope> {
      return requestJson<ProvidersEnvelope>(
        "/api/v1/providers",
        {
          method: "GET",
          headers: ACCEPT_JSON
        },
        "Providers request"
      );
    },
    async updateProvider(
      providerKey: string,
      payload: UpdateDefinitionRequest
    ): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        `/api/v1/providers/${encodeURIComponent(providerKey)}`,
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload)
        },
        "Update provider request"
      );
    },
    async listBackups(): Promise<BackupsEnvelope> {
      return requestJson<BackupsEnvelope>(
        "/api/v1/backups",
        {
          method: "GET",
          headers: ACCEPT_JSON
        },
        "Backups request"
      );
    },
    async restoreBackup(snapshotId: string): Promise<ProfileMutationEnvelope> {
      return requestJson<ProfileMutationEnvelope>(
        `/api/v1/backups/restore/${encodeURIComponent(snapshotId)}`,
        {
          method: "POST",
          headers: ACCEPT_JSON
        },
        "Restore backup request"
      );
    }
  };
}
