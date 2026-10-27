import path from "node:path";

import eslint from "@eslint/js";
import { includeIgnoreFile } from "eslint/config";
import importPlugin, { createNodeResolver } from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

import kebabCaseFileNames from "./scripts/eslint/kebab-case-file-names.mjs";
import noArtifactPathLiterals from "./scripts/eslint/no-artifact-path-literals.mjs";
import noDirectoryLiterals from "./scripts/eslint/no-directory-literals.mjs";
import noEagerFixtureSetup from "./scripts/eslint/no-eager-fixture-setup.mjs";
import noLateFixtureTeardown from "./scripts/eslint/no-late-fixture-teardown.mjs";

const gitignorePath = path.join(import.meta.dirname, ".gitignore");
const uiPackage = path.join(import.meta.dirname, "packages/ui");

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
          "kebab-case-file-names": kebabCaseFileNames,
          "no-artifact-path-literals": noArtifactPathLiterals,
          "no-directory-literals": noDirectoryLiterals,
          "no-eager-fixture-setup": noEagerFixtureSetup,
          "no-late-fixture-teardown": noLateFixtureTeardown,
        },
      },
    },
    settings: {
      "import-x/internal-regex": "^@mokly/(?:mokly|ui|viewer)(?:/|$)",
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
  // Tests must not assert elapsed time. The selectors reject a clock call
  // minus a non-literal and a clock call plus a literal below 10,000 ms;
  // variable deadlines and indirect clock calls pass both.
  // tests/test_timing_lint.test.ts checks each form with `ESLint.lintText`.
  {
    files: [
      "tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}",
      "packages/ui/tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}",
    ],
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
  // The boundary between @mokly/ui and @mokly/viewer. The rules resolve
  // imports, and TypeScript sources import `.js` and `.mjs` specifiers that
  // name `.ts`, `.tsx`, and `.mts` files. Neither package reaches another
  // package by a relative path; the tests of both may import the shared test
  // helpers. tests/ui_boundary_lint.test.ts checks each rule.
  {
    files: [
      "packages/ui/**/*.{js,mjs,cjs,ts,tsx,mts,cts}",
      "packages/viewer/**/*.{js,mjs,cjs,ts,tsx,mts,cts}",
    ],
    settings: {
      "import-x/resolver-next": [
        createNodeResolver({
          extensionAlias: {
            ".js": [".ts", ".tsx", ".js"],
            ".mjs": [".mts", ".mjs"],
          },
        }),
      ],
    },
    rules: {
      "import/no-relative-packages": [
        "error",
        { ignore: ["^(?:\\.\\./)+tests/helpers/"] },
      ],
    },
  },
  // A package component imports only what packages/ui/package.json declares
  // as a dependency or a peer, including types and other @mokly packages.
  {
    files: ["packages/ui/src/**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "import/no-extraneous-dependencies": [
        "error",
        {
          packageDir: uiPackage,
          devDependencies: false,
          optionalDependencies: false,
          peerDependencies: true,
          includeInternal: true,
          includeTypes: true,
        },
      ],
    },
  },
  {
    files: ["packages/viewer/**/*.{js,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: import.meta.dirname,
          zones: [
            {
              target: "packages/viewer",
              from: "packages/ui/src",
              message: "Import @mokly/ui through its published subpaths.",
            },
          ],
        },
      ],
    },
  },
  // File names in @mokly/ui are kebab-case, so that a component file matches
  // its published subpath. tests/ui_file_names_lint.test.ts checks the rule.
  {
    files: [
      "packages/ui/src/**/*.{js,mjs,cjs,ts,tsx,mts,cts}",
      "packages/ui/tests/**/*.{js,mjs,cjs,ts,tsx,mts,cts}",
    ],
    rules: {
      "mokly/kebab-case-file-names": ["error", { root: uiPackage }],
    },
  },
  {
    files: ["packages/viewer/src/**/*.{ts,tsx}"],
    ignores: [
      "packages/viewer/src/catalogue/delivery_paths.ts",
      "packages/viewer/src/generated/catalogue/Namespace.ts",
    ],
    rules: {
      "mokly/no-directory-literals": "error",
    },
  },
  // Comparison artifact paths come only from the shared builders in
  // packages/viewer/src/navigation/routes.ts, which the Rust core mirrors in
  // crates/mokly-model/src/routes.rs. The rule covers the viewer source,
  // scripts and examples, and exempts the builders and test directories.
  {
    files: [
      "packages/viewer/src/**/*.{ts,tsx}",
      "scripts/**/*.{mjs,mts,ts}",
      "examples/**/*.{ts,tsx,mjs}",
    ],
    ignores: ["packages/viewer/src/navigation/routes.ts", "**/tests/**"],
    rules: {
      "mokly/no-artifact-path-literals": "error",
    },
  },
);
