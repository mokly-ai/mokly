import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.context/**",
      "**/dist/**",
      "examples/basic/generated/**",
      "node_modules/**",
      "target/**",
    ],
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { import: importPlugin },
    settings: {
      "import-x/internal-regex": "^@mokly/(?:mokly|viewer)(?:/|$)",
    },
    rules: {
      "import/first": "error",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            ["sibling", "index"],
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
        },
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
