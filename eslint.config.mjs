import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import typescriptEslint from "typescript-eslint";

const eslintConfig = defineConfig([
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  next.configs["core-web-vitals"],
  reactHooks.configs.flat["recommended-latest"],
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "pytest-cache-files-*/**",
    ".codex-spreadsheet/**",
    "outputs/**",
  ]),
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        fetch: "readonly",
        process: "readonly",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
