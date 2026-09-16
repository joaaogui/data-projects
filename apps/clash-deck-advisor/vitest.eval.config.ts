import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Evals hit the live Clash Royale API and real models, so they are kept out
 * of the unit test run and given a budget that fits a full analysis.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.eval.ts"],
    setupFiles: ["./src/test/load-env.ts"],
    testTimeout: 180_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      "server-only": path.resolve(root, "./src/test/server-only-stub.ts"),
    },
  },
});
