import { createApiClient } from "@opencode-console/api-client-generated";
import type {
  JobsListEnvelope,
  JobDetailEnvelope,
  JobLogsEnvelope,
  JobMutationEnvelope,
  CreateJobInput,
} from "@/lib/jobs-domain";

const apiBaseUrl =
  import.meta.env.VITE_CONSOLE_API_BASE_URL ?? "http://127.0.0.1:4310";

const generatedClient = createApiClient({ baseUrl: apiBaseUrl });

const ACCEPT_JSON = { Accept: "application/json" } as const;
const JSON_HEADERS = { ...ACCEPT_JSON, "Content-Type": "application/json" } as const;

async function requestJson<T>(
  path: string,
  init: globalThis.RequestInit,
  failureContext: string
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);

  if (!response.ok) {
    throw new Error(
      `${failureContext} failed with status ${response.status}`
    );
  }

  return (await response.json()) as T;
}

export const apiClient = {
  ...generatedClient,

  async listJobs(): Promise<JobsListEnvelope> {
    return requestJson<JobsListEnvelope>(
      "/api/v1/jobs",
      { method: "GET", headers: ACCEPT_JSON },
      "List jobs request"
    );
  },

  async createJob(input: CreateJobInput): Promise<JobMutationEnvelope> {
    return requestJson<JobMutationEnvelope>(
      "/api/v1/jobs",
      {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
      },
      "Create job request"
    );
  },

  async getJob(jobId: string): Promise<JobDetailEnvelope> {
    return requestJson<JobDetailEnvelope>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}`,
      { method: "GET", headers: ACCEPT_JSON },
      "Get job request"
    );
  },

  async getJobLogs(jobId: string): Promise<JobLogsEnvelope> {
    return requestJson<JobLogsEnvelope>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}/logs`,
      { method: "GET", headers: ACCEPT_JSON },
      "Get job logs request"
    );
  },

  async cancelJob(jobId: string): Promise<JobMutationEnvelope> {
    return requestJson<JobMutationEnvelope>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}/cancel`,
      { method: "POST", headers: ACCEPT_JSON },
      "Cancel job request"
    );
  },

  async retryJob(jobId: string): Promise<JobMutationEnvelope> {
    return requestJson<JobMutationEnvelope>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}/retry`,
      { method: "POST", headers: ACCEPT_JSON },
      "Retry job request"
    );
  },
};
