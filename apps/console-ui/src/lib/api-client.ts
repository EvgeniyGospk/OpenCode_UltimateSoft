import { createApiClient } from "@opencode-console/api-client-generated";

const apiBaseUrl =
  import.meta.env.VITE_CONSOLE_API_BASE_URL ?? "http://127.0.0.1:4310";

export const apiClient = createApiClient({ baseUrl: apiBaseUrl });
