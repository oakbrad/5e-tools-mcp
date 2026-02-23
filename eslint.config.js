// eslint.config.js — flat config for TypeScript
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      // Allow explicit `any` — the 5etools data is loosely typed
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unused vars prefixed with _ (common convention)
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "5etools-src/**"],
  },
);
