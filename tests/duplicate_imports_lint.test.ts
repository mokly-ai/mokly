import assert from "node:assert/strict";
import test from "node:test";

import ts from "typescript";

import { lintProbe, requireLintRule } from "./helpers/lint_config.js";

const rule = "import/no-duplicates";
const probes = [
  "src/lint-coverage-probe.ts",
  "packages/viewer/src/lint-coverage-probe.tsx",
  "scripts/preview/lint-coverage/nested/probe.mjs",
  "tests/lint-coverage-probe.ts",
];

for (const filePath of probes)
  test(`duplicate imports use the real configured fixer in ${filePath}`, async () => {
    await requireLintRule(filePath, rule);
    const source = [
      'import { GENERATED_DIRECTORY } from "@mokly/viewer/data";',
      'import { VIEWER_DIRECTORY } from "@mokly/viewer/data";',
      "export const roots = [GENERATED_DIRECTORY, VIEWER_DIRECTORY];",
    ].join("\n");
    const result = await lintProbe(source, filePath);
    assert.ok(
      result.messages.some(({ ruleId }) => ruleId === rule),
      filePath,
    );
    const fixed = await lintProbe(source, filePath, true);
    assert.ok(fixed.output, filePath);
    assert.deepEqual(fixed.messages, []);
    assert.equal((fixed.output.match(/\bimport\b/gu) ?? []).length, 1);
    assert.match(
      fixed.output,
      /import \{[^}]*GENERATED_DIRECTORY[^}]*VIEWER_DIRECTORY[^}]*\} from "@mokly\/viewer\/data"/u,
    );
    assert.match(
      fixed.output,
      /export const roots = \[GENERATED_DIRECTORY, VIEWER_DIRECTORY\]/u,
    );
    assert.deepEqual((await lintProbe(fixed.output, filePath)).messages, []);
  });

for (const filePath of probes.filter((file) => !file.endsWith(".mjs")))
  test(`duplicate type imports preserve runtime imports in ${filePath}`, async () => {
    await requireLintRule(filePath, rule);
    const source = [
      'import "node:path";',
      'import type { PlatformPath } from "node:path";',
      'import type { FormatInputPathObject } from "node:path";',
      "export type Paths = [PlatformPath, FormatInputPathObject];",
    ].join("\n");
    assert.ok(
      (await lintProbe(source, filePath)).messages.some(
        ({ ruleId }) => ruleId === rule,
      ),
    );
    const fixed = await lintProbe(source, filePath, true);
    assert.ok(fixed.output);
    assert.deepEqual(fixed.messages, []);
    assert.match(fixed.output, /import "node:path";/u);
    assert.equal((fixed.output.match(/import type/gu) ?? []).length, 1);
    assert.match(
      fixed.output,
      /export type Paths = \[PlatformPath, FormatInputPathObject\]/u,
    );
  });

for (const filePath of probes.filter((file) => !file.endsWith(".mjs")))
  test(`type import consolidation retains emitted values in ${filePath}`, async () => {
    await requireLintRule(filePath, rule);
    const source = [
      'import type { Viewport } from "@mokly/viewer/data";',
      'import type { ColorScheme } from "@mokly/viewer/data";',
      'import { GENERATED_DIRECTORY } from "@mokly/viewer/data";',
      "export const root = GENERATED_DIRECTORY;",
      "export type State = [Viewport, ColorScheme];",
    ].join("\n");
    const fixed = await lintProbe(source, filePath, true);
    assert.ok(fixed.output);
    assert.deepEqual(fixed.messages, []);
    const emitted = ts.transpileModule(fixed.output, {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        verbatimModuleSyntax: true,
      },
    });
    assert.deepEqual(emitted.diagnostics, []);
    assert.match(
      emitted.outputText,
      /import \{ GENERATED_DIRECTORY \} from "@mokly\/viewer\/data"/u,
    );
    assert.match(
      emitted.outputText,
      /export (?:const|var) root = GENERATED_DIRECTORY/u,
    );
    assert.doesNotMatch(emitted.outputText, /Viewport|ColorScheme/u);
  });
