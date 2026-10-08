import path from "node:path";

import eslint from "@eslint/js";
import { includeIgnoreFile } from "eslint/config";
import importPlugin from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

import noArtifactPathLiterals from "./scripts/eslint/no-artifact-path-literals.mjs";
import noDirectoryLiterals from "./scripts/eslint/no-directory-literals.mjs";
import noEagerFixtureSetup from "./scripts/eslint/no-eager-fixture-setup.mjs";
import noLateFixtureTeardown from "./scripts/eslint/no-late-fixture-teardown.mjs";

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
      mokly: {
        rules: {
          "no-artifact-path-literals": noArtifactPathLiterals,
          "no-directory-literals": noDirectoryLiterals,
          "no-eager-fixture-setup": noEagerFixtureSetup,
          "no-late-fixture-teardown": noLateFixtureTeardown,
        },
      },
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
    files: ["tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    ignores: ["tests/helpers/durations.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
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
      ],
    },
  },
  {
    files: ["tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "mokly/no-eager-fixture-setup": "error",
      "mokly/no-late-fixture-teardown": "error",
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
    files: ["**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}"],
    ignores: [
      "**/tests/**",
      "docs/**",
      "plans/**",
      "**/generated/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "**/.mokly-cache/**",
      "packages/viewer/src/navigation/routes.ts",
    ],
    rules: {
      "mokly/no-artifact-path-literals": "error",
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
