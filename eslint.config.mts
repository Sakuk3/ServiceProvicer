import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";

export default defineConfig([
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ["test/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.test.json",
      },
    },
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "describe",
          property: "only",
          message: "Avoid focused tests in committed code.",
        },
        {
          object: "it",
          property: "only",
          message: "Avoid focused tests in committed code.",
        },
        {
          object: "test",
          property: "only",
          message: "Avoid focused tests in committed code.",
        },
      ],
    },
  },
  prettierConfig,
]);
