import path from "node:path";

import eslint from "@eslint/js";
import { includeIgnoreFile } from "eslint/config";
import importPlugin from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

const gitignorePath = path.join(import.meta.dirname, ".gitignore");

/** Test timing restrictions from docs/protocol/ci-test-timing.md. */
const testTimingRestrictions = [
  {
    selector:
      "BinaryExpression[operator='-'][right.type!='Literal']:matches([left.type='CallExpression'][left.callee.property.name='now'][left.callee.object.name=/^(performance|Date)$/], [left.callee.property.name='bigint'][left.callee.object.property.name='hrtime'])",
    message:
      "Use operation counts, captured watcher targets, event order, or fake clocks in tests. Report duration text with tests/helpers/durations.ts. See docs/protocol/ci-test-timing.md.",
  },
  {
    selector:
      "BinaryExpression[operator='+'][left.callee.property.name='now'][left.callee.object.name=/^(performance|Date)$/][right.type='Literal'][right.value<10000]",
    message:
      "Use polling deadlines of at least 10,000 ms. See docs/protocol/ci-test-timing.md.",
  },
];

/** Catalogue selection restrictions from docs/protocol/ci-test-assertions.md. */
const catalogueSelectionRestrictions = [
  {
    selector:
      "ForOfStatement[right.type='MemberExpression'][right.property.name='entries'] > BlockStatement > IfStatement:matches([consequent.type='ContinueStatement'], [consequent.type='BlockStatement'][consequent.body.length=1][consequent.body.0.type='ContinueStatement'])",
    message:
      "Select catalogue entries with entriesUnder or entriesWhere so an empty selection fails.",
  },
  {
    selector:
      "CallExpression[callee.object.property.name='entries'][callee.property.name=/^(filter|flatMap|find|findLast|findIndex|some|every)$/] CallExpression[callee.property.name=/^(startsWith|endsWith)$/][callee.object.property.name='path']",
    message:
      "Select catalogue entries with entriesUnder or entriesWhere so an empty selection fails.",
  },
  {
    selector:
      "CallExpression[callee.object.property.name='entries'][callee.property.name=/^(filter|flatMap|find|findLast|findIndex|some|every)$/] BinaryExpression[operator=/^[!=]==$/][left.property.name='path'][right.type=/^(Literal|TemplateLiteral)$/]",
    message:
      "Select literal catalogue paths with entryAt, entriesAt or assertAbsent.",
  },
];

/**
 * ESLint keeps only the last `no-restricted-syntax` options for a file, so a
 * block must list every restriction set that applies to its files.
 */
function restrictedSyntax(...restrictionSets) {
  return { "no-restricted-syntax": ["error", ...restrictionSets.flat()] };
}

export default tseslint.config(
  includeIgnoreFile(gitignorePath, "Repository .gitignore patterns"),
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
  {
    files: ["tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    ignores: ["tests/helpers/durations.ts"],
    rules: restrictedSyntax(testTimingRestrictions),
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    ignores: [
      "tests/helpers/catalogue_selection.ts",
      "tests/helpers/durations.ts",
    ],
    rules: restrictedSyntax(
      testTimingRestrictions,
      catalogueSelectionRestrictions,
    ),
  },
  {
    files: ["tests/helpers/durations.ts"],
    rules: restrictedSyntax(catalogueSelectionRestrictions),
  },
  {
    files: [
      "src/config/**/*.ts",
      "src/build/discovery.ts",
      "src/build/styles/**/*.ts",
      "src/build/source_inventory.ts",
      "src/build/package_owned_paths.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='localeCompare']",
          message:
            "Sort source paths with compareCodeUnits to avoid locale-dependent inventories and diagnostics.",
        },
      ],
    },
  },
);
