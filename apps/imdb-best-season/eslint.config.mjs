import { createNextEslintConfig } from "@data-projects/shared/eslint-config";

export default createNextEslintConfig({
  ignores: ["playwright-report/**", "test-results/**"],
});
