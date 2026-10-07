import assert from "node:assert/strict";
import test from "node:test";

import { lintProbe, requireLintRule } from "./helpers/lint_config.js";
import { localeProbes } from "./helpers/lint_paths.js";

const localeRule = "no-restricted-syntax";
const directoryRule = "mokly/no-directory-literals";
const message =
  "Sort source paths with compareCodeUnits to avoid locale-dependent inventories and diagnostics.";

for (const filePath of localeProbes)
  test(`source order and directory rules coexist in ${filePath}`, async () => {
    await requireLintRule(filePath, localeRule);
    await requireLintRule(filePath, directoryRule);
    const result = await lintProbe(
      [
        'export const roots = ["mokly-generated", "mokly-viewer"];',
        'export const order = "a".localeCompare("b");',
      ].join("\n"),
      filePath,
    );
    assert.deepEqual(
      result.messages.map(({ ruleId, message, severity }) => ({
        ruleId,
        message,
        severity,
      })),
      [
        {
          ruleId: directoryRule,
          message:
            "Import GENERATED_DIRECTORY instead of spelling the output directory.",
          severity: 2,
        },
        {
          ruleId: directoryRule,
          message:
            "Import VIEWER_DIRECTORY instead of spelling the viewer directory.",
          severity: 2,
        },
        { ruleId: localeRule, message, severity: 2 },
      ],
    );
    const clean = await lintProbe(
      [
        'import { compareCodeUnits } from "./code_units.js";',
        'export const order = compareCodeUnits("a", "b");',
      ].join("\n"),
      filePath,
    );
    assert.deepEqual(clean.messages, [], filePath);
  });

test("presentation collation stays outside the source-order ban", async () => {
  const filePath = "packages/viewer/src/shell/lint-coverage-probe.ts";
  await requireLintRule(filePath, directoryRule);
  const result = await lintProbe(
    'export const order = "a".localeCompare("b", "en");',
    filePath,
  );
  assert.deepEqual(result.messages, []);
});
