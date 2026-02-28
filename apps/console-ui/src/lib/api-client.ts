import { createApiClient } from "@opencode-console/api-client-generated";

const apiBaseUrl =
  import.meta.env.VITE_CONSOLE_API_BASE_URL ?? "http://127.0.0.1:4310";

/**
 * Single API client instance used across the UI.
 *
 * All methods (including jobs) come from the generated client which
 * is derived from the OpenAPI contract. No manual fetch wrappers needed.
 */
export const apiClient = createApiClient({ baseUrl: apiBaseUrl });
