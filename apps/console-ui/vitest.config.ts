import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "console-ui",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/main.tsx"],
      thresholds: {
        lines: 50,
        functions: 60,
        branches: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
