/** Pure graph and baseline tests for the test helper export scope. */

import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeExportScopes,
  exportScopeAudit,
  TEST_HELPER_EXPORT_SCOPE,
} from "../scripts/verification/repository-ratchets.mjs";

const helper = {
  path: "tests/helpers/value.ts",
  source: "export const value = 1;",
};
const helperKey = `${helper.path}#value`;

test("scope partition keeps unused keys with a hash in the module path", () => {
  const analysis = analyzeExportScopes({
    modules: [{ path: "src/hash#file.ts", source: helper.source }],
    publicEntrypoints: [],
  });
  assert.deepEqual(analysis.internal.unused, ["src/hash#file.ts#value"]);
});

test("helper candidates use both roots and every supported module extension", () => {
  const paths = ["tests/helpers", "packages/viewer/tests"].flatMap((root) =>
    ["ts", "tsx", "mts", "cts", "js", "mjs", "cjs"].map(
      (extension) => `${root}/value.${extension}`,
    ),
  );
  const analysis = analyzeExportScopes({
    modules: [
      ...paths.map((path) => ({ path, source: helper.source })),
      { path: "tests/helpers/ignored.jsx", source: helper.source },
    ],
    publicEntrypoints: [],
  });
  assert.equal(analysis.testHelpers.moduleCount, 14);
  assert.deepEqual(
    analysis.testHelpers.unused,
    paths.map((path) => `${path}#value`).sort(),
  );
  assert.deepEqual(analysis.internal, { moduleCount: 0, unused: [] });
});

test("unit files, browser specs, and fixtures remain importers but are not candidates", () => {
  for (const path of [
    "tests/use.test.ts",
    "tests/use.test.tsx",
    "tests/use.spec.ts",
    "packages/viewer/tests/use.test.ts",
    "packages/viewer/tests/use.test.tsx",
    "packages/viewer/tests/use.spec.ts",
    "tests/fixtures/use.ts",
  ]) {
    const analysis = analyzeExportScopes({
      modules: [
        helper,
        {
          path,
          source:
            'import { value } from "helper"; export const unused = value;',
        },
      ],
      publicEntrypoints: [],
      aliases: { helper: helper.path },
    });
    assert.deepEqual(
      analysis.testHelpers,
      { moduleCount: 1, unused: [] },
      path,
    );
  }
});

test("candidate exclusions use exact suffixes and the exact fixtures tree", () => {
  const paths = [
    "tests/helper.test.js",
    "tests/helper.test.mts",
    "tests/helper.spec.tsx",
    "tests/helper.TEST.ts",
    "tests/other/fixtures/helper.ts",
    "packages/viewer/tests/fixtures/helper.ts",
    "tests/fixtures-extra/helper.ts",
  ];
  const analysis = analyzeExportScopes({
    modules: paths.map((path) => ({ path, source: helper.source })),
    publicEntrypoints: [],
  });
  assert.equal(analysis.testHelpers.moduleCount, paths.length);
  assert.deepEqual(
    analysis.testHelpers.unused,
    paths.map((path) => `${path}#value`).sort(),
  );
});

test("root config and source imports count without runner reachability", () => {
  for (const path of [
    "playwright.config.ts",
    "src/use.ts",
    "packages/viewer/src/use.ts",
    "scripts/use.mjs",
  ]) {
    const analysis = analyzeExportScopes({
      modules: [
        helper,
        { path, source: 'import { value } from "helper"; void value;' },
      ],
      publicEntrypoints: [],
      aliases: { helper: helper.path },
    });
    assert.deepEqual(
      analysis.testHelpers,
      { moduleCount: 1, unused: [] },
      path,
    );
    assert.deepEqual(analysis.internal.unused, [], path);
  }
});

test("declaration files are neither candidates nor importers in either scope", () => {
  const declarations = [
    "types",
    "src",
    "tests",
    "packages/viewer/tests",
  ].flatMap((root) =>
    ["ts", "mts", "cts"].map((extension) => ({
      path: `${root}/use.d.${extension}`,
      source:
        'export { value } from "helper"; export { product } from "product"; export const declaration = 1;',
    })),
  );
  const analysis = analyzeExportScopes({
    modules: [
      helper,
      { path: "src/value.ts", source: "export const product = 1;" },
      ...declarations,
    ],
    publicEntrypoints: [],
    aliases: { helper: helper.path, product: "src/value.ts" },
  });
  assert.deepEqual(analysis.testHelpers, {
    moduleCount: 1,
    unused: [helperKey],
  });
  assert.deepEqual(analysis.internal, {
    moduleCount: 1,
    unused: ["src/value.ts#product"],
  });
});

test("a path-only global setup load does not use named value exports", () => {
  const analysis = analyzeExportScopes({
    modules: [
      {
        path: "playwright.config.ts",
        source: 'export default { globalSetup: "./tests/browser/setup.ts" };',
      },
      {
        path: "tests/browser/setup.ts",
        source:
          "export const named = 1; void named; export type TypeOnly = string; export interface InterfaceOnly {} export default function setup() {}",
      },
    ],
    publicEntrypoints: [],
  });
  assert.deepEqual(analysis.testHelpers, {
    moduleCount: 1,
    unused: ["tests/browser/setup.ts#named"],
  });
});

test("the shared graph retains cross-scope uses, CommonJS use, and public exports", () => {
  const analysis = analyzeExportScopes({
    modules: [
      { path: "tests/helpers/value.cjs", source: "exports.value = 1;" },
      {
        path: "src/consumer.ts",
        source:
          'const { value } = require("../tests/helpers/value.cjs"); export const product = value;',
      },
      {
        path: "packages/viewer/tests/use.test.ts",
        source:
          'import { product } from "../../../src/consumer.js"; void product;',
      },
      { path: "src/index.ts", source: "export const publicValue = 1;" },
    ],
    publicEntrypoints: ["src/index.ts"],
  });
  assert.deepEqual(analysis.internal, { moduleCount: 2, unused: [] });
  assert.deepEqual(analysis.testHelpers, { moduleCount: 1, unused: [] });
});

test("the helper finding text names the exact unused key", () => {
  assert.deepEqual(
    exportScopeAudit(
      { unused: [helperKey], baseline: [] },
      TEST_HELPER_EXPORT_SCOPE,
    ),
    {
      unused: [helperKey],
      findings: [`new unused test helper export: ${helperKey}`],
    },
  );
});

test("helper baselines accept exact keys under both allowed prefixes", () => {
  const keys = ["packages/viewer/tests/value.ts#value", helperKey];
  assert.deepEqual(
    exportScopeAudit(
      { unused: keys, baseline: keys, baselineAtComparison: keys },
      TEST_HELPER_EXPORT_SCOPE,
    ).findings,
    [],
  );
});

test("helper baseline prefixes reject source-root and incomplete keys", () => {
  for (const entry of [
    "src/value.ts#value",
    "scripts/value.mjs#value",
    "tests#value",
    "tests/value.ts#",
    "tests/value.ts#two words",
    "tests/value.ts#one#two",
    "",
  ]) {
    const result = exportScopeAudit(
      { unused: [], baseline: [entry] },
      TEST_HELPER_EXPORT_SCOPE,
    );
    assert.ok(
      result.findings.includes(
        `invalid unused test helper export baseline entry: ${entry}`,
      ),
      entry,
    );
  }
});

test("helper baseline format errors are exact and sorted", () => {
  const a = "tests/a.ts#a";
  const z = "tests/z.ts#z";
  const result = exportScopeAudit(
    { unused: [a, z], baseline: [z, a, a] },
    TEST_HELPER_EXPORT_SCOPE,
  );
  assert.deepEqual(result.findings, [
    "unused test helper export baseline contains duplicates",
    "unused test helper export baseline must be sorted",
  ]);
});

test("helper baseline subset checks reject stale entries and growth", () => {
  assert.deepEqual(
    exportScopeAudit(
      { unused: [], baseline: [helperKey] },
      TEST_HELPER_EXPORT_SCOPE,
    ).findings,
    [`stale baseline entry: delete ${helperKey}`],
  );
  assert.deepEqual(
    exportScopeAudit(
      { unused: [helperKey], baseline: [helperKey], baselineAtComparison: [] },
      TEST_HELPER_EXPORT_SCOPE,
    ).findings,
    [`baseline entry was not present at the comparison commit: ${helperKey}`],
  );
  assert.deepEqual(
    exportScopeAudit(
      { unused: [], baseline: [], baselineAtComparison: [helperKey] },
      TEST_HELPER_EXPORT_SCOPE,
    ).findings,
    [],
  );
});

test("wildcard baseline keys do not suppress exact unused keys", () => {
  assert.deepEqual(
    exportScopeAudit(
      { unused: [helperKey], baseline: ["tests/helpers/*#*"] },
      TEST_HELPER_EXPORT_SCOPE,
    ).findings,
    [
      `new unused test helper export: ${helperKey}`,
      "stale baseline entry: delete tests/helpers/*#*",
    ],
  );
});
