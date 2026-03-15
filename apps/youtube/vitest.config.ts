import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 35,
        branches: 30,
        functions: 30,
        lines: 35,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
