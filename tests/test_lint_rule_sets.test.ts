/** Verify that the test lint rule sets combine instead of replacing each other. */
import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

import { repositoryRoot } from "./helpers/fixture.js";

const eslint = new ESLint({ cwd: repositoryRoot });
const catalogueMessage = /entriesUnder or entriesWhere/u;
const timingMessage = /docs\/protocol\/ci-test-timing\.md/u;
const source = `
  export function check(manifest, started) {
    void (performance.now() - started);
    return manifest.entries.filter((entry) => entry.path.startsWith("design/"));
  }
`;

async function restrictions(filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath });
  assert.ok(result, filePath);
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-syntax")
    .map((message) => message.message);
}

for (const [filePath, catalogue, timing] of [
  ["tests/lint_rule_sets_probe.test.ts", true, true],
  ["tests/lint_rule_sets_probe.test.tsx", true, true],
  ["tests/browser/lint_rule_sets_probe.spec.ts", true, true],
  ["tests/lint_rule_sets_probe.test.mjs", false, true],
  ["tests/helpers/catalogue_selection.ts", false, true],
  ["tests/helpers/durations.ts", true, false],
] as const) {
  test(`${filePath} gets catalogue ${catalogue} and timing ${timing} restrictions`, async () => {
    const messages = await restrictions(filePath);
    assert.equal(
      messages.some((message) => catalogueMessage.test(message)),
      catalogue,
      `${filePath}: ${JSON.stringify(messages)}`,
    );
    assert.equal(
      messages.some((message) => timingMessage.test(message)),
      timing,
      `${filePath}: ${JSON.stringify(messages)}`,
    );
    assert.equal(messages.length, Number(catalogue) + Number(timing));
  });
}
