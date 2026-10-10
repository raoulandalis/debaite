import path from "node:path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": path.resolve(
        import.meta.dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "**/.next/**",
      ...(process.env.VITEST_INCLUDE_OLLAMA_LIVE === "1"
        ? []
        : ["tests/ollama/live.test.ts"]),
    ],
  },
});
