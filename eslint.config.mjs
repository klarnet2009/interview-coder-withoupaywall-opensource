import js from "@eslint/js";
import globals from "globals";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import json from "@eslint/json";
import css from "@eslint/css";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.git/**",
      "dist/**",
      "dist-electron/**",
      "release/**",
      "coverage/**",
      "renderer/**",
      "assets/**",
      "**/*.md",
      "package-lock.json",
      "bun.lockb",
      "src/index.css",
      "public/pcm-capture-processor.js"
    ]
  },

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslintPlugin.configs.recommended.rules,
      "no-undef": "off",
    },
  },

  {
    files: ["**/*.json"],
    language: "json/json",
    ...json.configs.recommended,
  },
  {
    files: ["**/*.jsonc"],
    language: "json/jsonc",
    ...json.configs.recommended,
  },
  {
    files: ["**/*.json5"],
    language: "json/json5",
    ...json.configs.recommended,
  },
  {
    files: ["**/*.css"],
    language: "css/css",
    plugins: { css },
    rules: { ...css.configs.recommended.rules },
  },
];
