import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 24,
        branches: 23,
        functions: 27,
        lines: 24,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
