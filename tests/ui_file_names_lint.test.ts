import assert from "node:assert/strict";
import test from "node:test";

import { lintProbe, requireLintRule } from "./helpers/lint_config.js";

const rule = "mokly/kebab-case-file-names";

async function namingMessages(filePath: string) {
  const result = await lintProbe("export const value = 1;\n", filePath);
  return result.messages
    .filter(({ ruleId }) => ruleId === rule)
    .map(({ message, severity }) => ({ message, severity }));
}

function rejection(name: string) {
  return {
    message: `Use a kebab-case name for ${name}: lowercase letters and digits joined by single hyphens, then the extension, as in top-bar.tsx.`,
    severity: 2,
  };
}

test("UI package sources and tests accept kebab-case names", async () => {
  for (const filePath of [
    "packages/ui/src/top-bar/top-bar.tsx",
    "packages/ui/src/icons/icons.ts",
    "packages/ui/src/comparison-toolbar/comparison-toolbar.tsx",
    "packages/ui/src/menu2/menu2.mts",
    "packages/ui/tests/dom.ts",
    "packages/ui/tests/top-bar.test.tsx",
    "packages/ui/tests/helpers/top-bar-fixture.mjs",
  ]) {
    await requireLintRule(filePath, rule);
    assert.deepEqual(await namingMessages(filePath), [], filePath);
  }
});

test("UI package sources and tests reject other names", async () => {
  for (const [filePath, names] of [
    ["packages/ui/src/top-bar/TopBar.tsx", ["TopBar.tsx"]],
    ["packages/ui/src/top-bar/top_bar.tsx", ["top_bar.tsx"]],
    ["packages/ui/src/TopBar/top-bar.tsx", ["TopBar"]],
    ["packages/ui/src/top--bar/top-bar.tsx", ["top--bar"]],
    ["packages/ui/src/top_bar/topBar.ts", ["top_bar", "topBar.ts"]],
    ["packages/ui/tests/TopBar.test.tsx", ["TopBar.test.tsx"]],
    ["packages/ui/tests/-dom.ts", ["-dom.ts"]],
    ["packages/ui/tests/dom-.ts", ["dom-.ts"]],
  ] as const)
    assert.deepEqual(
      await namingMessages(filePath),
      names.map(rejection),
      filePath,
    );
});

test("the naming rule leaves the other packages and the UI scripts alone", async () => {
  for (const filePath of [
    "packages/viewer/src/shell/top_bar.tsx",
    "packages/ui/scripts/clean_dist.mjs",
    "tests/top_bar_lint.test.ts",
  ])
    assert.deepEqual(await namingMessages(filePath), [], filePath);
});
