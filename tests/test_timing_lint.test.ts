import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

import { TEST_ROOTS } from "../scripts/verification/test-roots.mjs";

const eslint = new ESLint();
const extensions = ["js", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
const testPaths = TEST_ROOTS.flatMap((root) =>
  extensions.flatMap((extension) => [
    `${root}/example.test.${extension}`,
    `${root}/browser/example.spec.${extension}`,
  ]),
);
const elapsedExpressions = [
  "performance.now() - started",
  "Date.now() - started",
  "process.hrtime.bigint() - started",
  "window.performance.now() - started",
  "globalThis.performance.now() - started",
  "new Date().getTime() - started",
];
const rejectedExpressions = [
  ...elapsedExpressions,
  "Date.now() + 5_000",
  "performance.now() + 2000",
  "window.performance.now() + 2000",
  "new Date().getTime() + 9_999",
];
const allowedExpressions = [
  "performance.now() + 20_000",
  "Date.now() + 10_000",
  "performance.now() < deadline",
  "Date.now() + timeoutMs",
  "new Date(Date.now() - 10_000)",
  "clock() - started",
  "new Date(value).getTime() - started",
  "new Date(0).getTime() - started",
  "window.performance.now() + 10_000",
  "new Date().getTime() + 10_000",
];

for (const filePath of testPaths) {
  test(`timing lint rejects elapsed subtraction and short deadlines in ${filePath}`, async (context) => {
    for (const expression of rejectedExpressions) {
      await context.test(expression, async () => {
        for (const input of [
          expression,
          `page.evaluate(() => ${expression})`,
        ]) {
          const messages = await restrictedSyntaxMessages(input, filePath);
          assert.equal(messages.length, 1, `${filePath}: ${input}`);
          assert.equal(messages[0]!.severity, 2, `${filePath}: ${input}`);
          assert.match(
            messages[0]!.message,
            /docs\/protocol\/ci-test-timing\.md/u,
          );
          assert.match(messages[0]!.message, /[Uu]se/u);
        }
      });
    }
  });

  test(`timing lint allows deadlines and timestamp data in ${filePath}`, async () => {
    for (const expression of allowedExpressions) {
      for (const input of [expression, `page.evaluate(() => ${expression})`]) {
        const messages = await restrictedSyntaxMessages(input, filePath);
        assert.deepEqual(messages, [], `${filePath}: ${input}`);
      }
    }
  });
}

for (const filePath of [
  "tests/helpers/durations.ts",
  "src/example.ts",
  "scripts/large/example.mjs",
]) {
  test(`timing lint allows clock subtraction outside its scope in ${filePath}`, async () => {
    for (const expression of elapsedExpressions) {
      const messages = await restrictedSyntaxMessages(expression, filePath);
      assert.deepEqual(messages, [], `${filePath}: ${expression}`);
    }
  });
}

for (const filePath of [
  "src/config/example.ts",
  "src/build/discovery.ts",
  "src/build/styles/example.ts",
  "src/build/source_inventory.ts",
  "src/build/package_owned_paths.ts",
]) {
  test(`timing lint preserves the localeCompare restriction in ${filePath}`, async () => {
    const messages = await restrictedSyntaxMessages(
      '"first".localeCompare("second")',
      filePath,
    );
    assert.equal(messages.length, 1, filePath);
    assert.equal(messages[0]!.severity, 2, filePath);
    assert.match(messages[0]!.message, /compareCodeUnits/u);
  });
}

async function restrictedSyntaxMessages(expression: string, filePath: string) {
  const [result] = await eslint.lintText(`void (${expression});\n`, {
    filePath,
  });
  assert.ok(result, filePath);
  assert.equal(result.fatalErrorCount, 0, `${filePath}: ${expression}`);
  assert.equal(result.warningCount, 0, `${filePath}: ${expression}`);
  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-syntax",
  );
}
