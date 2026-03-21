import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import tsdoc from "eslint-plugin-tsdoc";

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
    files: ["**/*.ts"],
    plugins: {
      tsdoc,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "prefer-destructuring": [
        "error",
        {
          VariableDeclarator: {
            object: true,
            array: false,
          },
          AssignmentExpression: {
            object: true,
            array: false,
          },
        },
      ],
      "tsdoc/syntax": "error",
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
      "no-restricted-globals": [
        "error",
        {
          name: "xdescribe",
          message: "Avoid disabled tests in committed code.",
        },
        {
          name: "xit",
          message: "Avoid disabled tests in committed code.",
        },
        {
          name: "xtest",
          message: "Avoid disabled tests in committed code.",
        },
        {
          name: "fdescribe",
          message: "Avoid focused tests in committed code.",
        },
        {
          name: "fit",
          message: "Avoid focused tests in committed code.",
        },
      ],
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
        {
          object: "describe",
          property: "skip",
          message: "Avoid disabled tests in committed code.",
        },
        {
          object: "it",
          property: "skip",
          message: "Avoid disabled tests in committed code.",
        },
        {
          object: "test",
          property: "skip",
          message: "Avoid disabled tests in committed code.",
        },
      ],
    },
  },
  {
    files: ["examples/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.test.json",
      },
    },
  },
  prettierConfig,
]);
