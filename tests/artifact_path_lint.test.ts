import assert from "node:assert/strict";
import test from "node:test";

import {
  lintProbe,
  repositoryEslint,
  requireLintRule,
} from "./helpers/lint_config.js";

const rule = "mokly/no-artifact-path-literals";
const message =
  "Build comparison artifact paths with the shared builders in packages/viewer/src/navigation/routes.ts instead of spelling snapshot paths or pages/…json.";
const scopedProbes = [
  "probe.ts",
  "src/artifact-path-probe.cjs",
  "src/artifact-path-probe.jsx",
  "src/artifact-path-probe.ts",
  "src/review/artifact-path-probe.tsx",
  "packages/viewer/src/artifact-path-probe.ts",
  "packages/viewer/src/navigation/artifact-path-probe.tsx",
  "packages/viewer/scripts/probe.mjs",
  "scripts/artifact-path-probe.mjs",
  "scripts/verification/artifact-path-probe.mts",
  "scripts/nested/artifact-path-probe.ts",
  "examples/artifact-path-probe.ts",
  "examples/basic/specs/artifact-path-probe.tsx",
  "examples/basic/artifact-path-probe.mjs",
];
const exemptProbes = [
  "docs/probe.ts",
  "plans/probe.ts",
  "packages/viewer/src/navigation/routes.ts",
  "tests/artifact-path-probe.test.ts",
  "src/review/tests/artifact-path-probe.ts",
  "packages/viewer/src/tests/artifact-path-probe.tsx",
  "scripts/tests/artifact-path-probe.mjs",
  "examples/basic/tests/artifact-path-probe.ts",
];
const offendingExpressions = [
  '"snapshots/before/catalogue/home/index.desktop.html"',
  "'review/snapshots/'",
  String.raw`"snapshots\u002Fafter"`,
  '"pages/home.json"',
  '"static/pages/docs/guide/index.json"',
  "`snapshots/${side}/${route}`",
  "`${root}/snapshots/${side}/snapshots/${route}`",
  "`pages/${route}.json`",
  "`pages/${folder}/${name}.json`",
];
const cleanSource = [
  'import { snapshotViewPath } from "@mokly/viewer/data";',
  'export const path = snapshotViewPath("before", "home", "mobile", "dark");',
  'export const label = "snapshots";',
  'export const file = "pages.json";',
  "export const route = `pages/${name}`;",
  "// A comment may spell snapshots/ and pages/home.json.",
].join("\n");

async function ruleMessages(source: string, filePath: string) {
  const result = await lintProbe(source, filePath);
  return result.messages
    .filter(({ ruleId }) => ruleId === rule)
    .map(({ ruleId, message, severity }) => ({ ruleId, message, severity }));
}

for (const filePath of scopedProbes)
  test(`artifact path literals are rejected in ${filePath}`, async () => {
    await requireLintRule(filePath, rule);
    for (const expression of offendingExpressions)
      assert.deepEqual(
        await ruleMessages(`export const value = ${expression};`, filePath),
        [{ ruleId: rule, message, severity: 2 }],
        `${filePath}: ${expression}`,
      );
    assert.deepEqual(await ruleMessages(cleanSource, filePath), [], filePath);
  });

for (const filePath of exemptProbes)
  test(`artifact path literals are allowed in ${filePath}`, async () => {
    const config = await repositoryEslint.calculateConfigForFile(filePath);
    assert.equal(config?.rules?.[rule], undefined, filePath);
    for (const expression of offendingExpressions)
      assert.deepEqual(
        await ruleMessages(`export const value = ${expression};`, filePath),
        [],
        `${filePath}: ${expression}`,
      );
  });
