import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(currentDir, "src"),
      "@opencode-console/api-client-generated": resolve(
        currentDir,
        "../../packages/api-client-generated/src/index.ts"
      )
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    watch: {
      usePolling: !!process.env.VITE_USE_POLLING,
      interval: Number(process.env.VITE_POLL_INTERVAL) || 300,
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"]
    }
  }
});
