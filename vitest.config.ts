import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/console-api/vitest.config.ts",
      "apps/console-ui/vitest.config.ts",
    ],
  },
});
