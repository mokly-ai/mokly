import assert from "node:assert/strict";
import test from "node:test";

import {
  createSelectedHarness,
  runSelected,
} from "./helpers/verification_unit_selected.js";
import {
  runWrapper,
  writeHarnessFile,
} from "./helpers/verification_wrapper.js";

interface FailedChild extends Error {
  code: number;
  stderr: string;
  stdout: string;
}

const earlyExitSource =
  'import test from "node:test";\n' +
  'test("a", () => {});\n' +
  'test("b", () => process.exit(0));\n' +
  'test("c", () => { throw new Error("must not be hidden"); });\n';

function noTestResults(files: readonly string[]) {
  return (error: FailedChild): boolean => {
    assert.equal(error.code, 1);
    assert.equal(
      error.stderr,
      files.length +
        " selected unit test " +
        (files.length === 1 ? "file" : "files") +
        " reported no test results:\n" +
        files
          .slice(0, 20)
          .map((file) => "✖ " + file)
          .join("\n") +
        (files.length > 20 ? "\n… and " + (files.length - 20) + " more" : "") +
        "\nPossible causes: the file registers no tests, or a test ended the process early (for example with process.exit).\n",
    );
    assert.doesNotMatch(error.stderr, / {4}at |Node\.js v/u);
    assert.doesNotMatch(error.stdout, /reported no test results:/u);
    for (const file of files)
      assert.ok(!error.stdout.includes("warning: no test ran in " + file));
    return true;
  };
}

test("zero-test files warn without a name pattern and still pass", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/passing.test.ts",
    'import { describe } from "node:test";\ndescribe("empty suite", () => {});\n',
  );
  const { stdout } = await runSelected(harness, ["tests/passing.test.ts"]);
  assert.match(
    stdout,
    /unit tests skipped or todo: 0\nwarning: no test ran in tests\/passing\.test\.ts\nselected files: 1; tests run: 0; partial verification; complete gate: cargo xtask check/u,
  );
  assert.doesNotMatch(stdout, /check --test-name-pattern/u);
});

test("zero-match patterns warn for each selected file in argument order", async (context) => {
  const harness = await createSelectedHarness(context);
  const { stdout } = await runSelected(harness, [
    "tests/passing.test.ts",
    "tests/failing.test.ts",
    "--test-name-pattern=no matching title",
  ]);
  assert.match(
    stdout,
    /unit tests skipped or todo: 0\nwarning: no test ran in tests\/passing\.test\.ts; check --test-name-pattern\nwarning: no test ran in tests\/failing\.test\.ts; check --test-name-pattern\nselected files: 2; tests run: 0;/u,
  );
});

test("tests run sums per-file executed tests without skips or todos", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/passing.test.ts",
    'import test from "node:test";\ntest("one", () => {});\ntest("two", () => {});\ntest.skip("skipped");\ntest.todo("todo");\n',
  );
  const { stdout } = await runSelected(harness, ["tests/passing.test.ts"]);
  assert.match(
    stdout,
    /unit tests skipped or todo: 2\nselected files: 1; tests run: 2;/u,
  );
  assert.doesNotMatch(stdout, /warning: no test ran/u);
});

test("pattern-only runs warn once only when all files report zero tests", async (context) => {
  const harness = await createSelectedHarness(context);
  const matched = await runSelected(harness, [
    "--test-name-pattern=selected passing",
  ]);
  assert.match(matched.stdout, /tests run: 1;/u);
  assert.doesNotMatch(matched.stdout, /warning:/u);
  const empty = await runSelected(harness, [
    "--test-name-pattern=never matches",
  ]);
  assert.match(
    empty.stdout,
    /warning: no test matched --test-name-pattern\nselected files: 2; tests run: 0;/u,
  );
  assert.doesNotMatch(empty.stdout, /warning: no test ran in/u);
  assert.equal(empty.stdout.match(/warning:/gu)?.length, 1);
});

for (const source of [
  "",
  'import test from "node:test";\nif (process.platform === "not-a-platform") test("absent", () => {});\n',
]) {
  test(
    "named file-only passes fail and preserve strict summary requirements: " +
      JSON.stringify(source),
    async (context) => {
      const harness = await createSelectedHarness(context);
      await writeHarnessFile(harness.root, "tests/passing.test.ts", source);
      await assert.rejects(
        runSelected(harness, ["tests/passing.test.ts"]),
        noTestResults(["tests/passing.test.ts"]),
      );
      await assert.rejects(
        runWrapper(harness.root, "run-unit.mjs", { args: ["--shard", "2/2"] }),
        /unobserved|executed file|inventory|assigned/u,
      );
    },
  );
}

test("a named early process exit fails with no test results", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/failing.test.ts",
    earlyExitSource,
  );
  await assert.rejects(
    runSelected(harness, ["tests/failing.test.ts"]),
    noTestResults(["tests/failing.test.ts"]),
  );
});

test("a pattern-only run names only the file that exits early", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/failing.test.ts",
    earlyExitSource,
  );
  await assert.rejects(
    runSelected(harness, ["--test-name-pattern=."]),
    (error: FailedChild) => {
      noTestResults(["tests/failing.test.ts"])(error);
      assert.match(error.stdout, /selected files: 2; tests run: 1;/u);
      assert.doesNotMatch(error.stdout, /warning:/u);
      return true;
    },
  );
});

test("a pattern-only run with no results prints no pattern warning", async (context) => {
  const harness = await createSelectedHarness(context);
  const files = ["tests/failing.test.ts", "tests/passing.test.ts"];
  for (const file of files) await writeHarnessFile(harness.root, file, "");
  await assert.rejects(
    runSelected(harness, ["--test-name-pattern=."]),
    (error: FailedChild) => {
      noTestResults(files)(error);
      assert.doesNotMatch(error.stdout, /warning:/u);
      return true;
    },
  );
});

test("files with no results keep selected order and stop after twenty names", async (context) => {
  const harness = await createSelectedHarness(context);
  const files = Array.from(
    { length: 23 },
    (_, index) => "tests/empty-" + (23 - index) + ".test.ts",
  );
  for (const file of files) await writeHarnessFile(harness.root, file, "");
  await assert.rejects(runSelected(harness, files), noTestResults(files));
});
