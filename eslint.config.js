import path from "node:path";

import eslint from "@eslint/js";
import { includeIgnoreFile } from "eslint/config";
import importPlugin from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

import noDirectoryLiterals from "./scripts/eslint/no-directory-literals.mjs";
import { TEST_ROOTS } from "./scripts/verification/test-roots.mjs";

const gitignorePath = path.join(import.meta.dirname, ".gitignore");
const sourceFiles = ["src/**/*.ts", "src/**/*.tsx"];
const postcssCallsModule = "src/build/styles/postcss_calls.ts";
const postcssCallsMessage = `Parse and process CSS only through ${postcssCallsModule}. Its calls always pass map: false, so PostCSS never loads a source map.`;
const postcssModuleSource = String.raw`/^postcss(?:$|\x2F)/`;
const postcssLoadRestrictions = [
  {
    selector: `ImportExpression[source.value=${postcssModuleSource}]`,
    message: postcssCallsMessage,
  },
  {
    selector: `CallExpression[arguments.0.value=${postcssModuleSource}]`,
    message: postcssCallsMessage,
  },
];
const sourcePathRestriction = {
  selector: "CallExpression[callee.property.name='localeCompare']",
  message:
    "Sort source paths with compareCodeUnits to avoid locale-dependent inventories and diagnostics.",
};
const directNowClock =
  "[left.type='CallExpression'][left.callee.property.name='now'][left.callee.object.name=/^(performance|Date)$/]";
const memberPerformanceClock =
  "[left.type='CallExpression'][left.callee.property.name='now'][left.callee.object.type='MemberExpression'][left.callee.object.property.name='performance']";
const hrtimeClock =
  "[left.type='CallExpression'][left.callee.property.name='bigint'][left.callee.object.property.name='hrtime']";
const currentDateClock =
  "[left.type='CallExpression'][left.callee.property.name='getTime'][left.callee.object.type='NewExpression'][left.callee.object.callee.name='Date'][left.callee.object.arguments.length=0]";
const elapsedClockSelector = `BinaryExpression[operator='-'][right.type!='Literal']:matches(${[
  directNowClock,
  memberPerformanceClock,
  hrtimeClock,
  currentDateClock,
].join(", ")})`;
const shortDeadlineSelector = `BinaryExpression[operator='+'][right.type='Literal'][right.value<10000]:matches(${[
  directNowClock,
  memberPerformanceClock,
  currentDateClock,
].join(", ")})`;

export default tseslint.config(
  includeIgnoreFile(gitignorePath, "Repository .gitignore patterns"),
  {
    ignores: [
      "**/.context/**",
      "**/.wrangler/**",
      "**/dist/**",
      "examples/basic/mokly-generated/**",
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
    plugins: {
      import: importPlugin,
      mokly: { rules: { "no-directory-literals": noDirectoryLiterals } },
    },
    settings: {
      "import-x/internal-regex": "^@mokly/(?:mokly|viewer)(?:/|$)",
    },
    rules: {
      "import/first": "error",
      "import/no-duplicates": "error",
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
    files: TEST_ROOTS.map((root) => `${root}/**/*.{js,mjs,cjs,ts,tsx,mts,cts}`),
    ignores: ["tests/helpers/durations.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: elapsedClockSelector,
          message:
            "Use operation counts, captured watcher targets, event order, or fake clocks in tests. Report duration text with tests/helpers/durations.ts. See docs/protocol/ci-test-timing.md.",
        },
        {
          selector: shortDeadlineSelector,
          message:
            "Use polling deadlines of at least 10,000 ms. See docs/protocol/ci-test-timing.md.",
        },
      ],
    },
  },
  {
    files: sourceFiles,
    rules: {
      "no-restricted-syntax": ["error", ...postcssLoadRestrictions],
    },
  },
  {
    files: sourceFiles,
    ignores: [postcssCallsModule],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "postcss",
              importNames: [
                "default",
                "fromJSON",
                "Input",
                "parse",
                "Processor",
              ],
              allowTypeImports: true,
              message: postcssCallsMessage,
            },
          ],
          patterns: [
            {
              regex: "^postcss/",
              allowTypeImports: true,
              message: postcssCallsMessage,
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "packages/viewer/src/**/*.{ts,tsx}",
      "scripts/preview/**/*.mjs",
    ],
    ignores: ["packages/viewer/src/catalogue/delivery_paths.ts"],
    rules: {
      "mokly/no-directory-literals": "error",
    },
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
        sourcePathRestriction,
        ...postcssLoadRestrictions,
      ],
    },
  },
);
