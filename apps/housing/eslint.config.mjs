import { createNextEslintConfig } from "@data-projects/shared/eslint-config";

export default [
  ...createNextEslintConfig(),
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
];
