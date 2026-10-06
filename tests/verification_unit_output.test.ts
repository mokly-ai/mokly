import assert from "node:assert/strict";
import test from "node:test";

import {
  createSelectedHarness,
  runSelected,
} from "./helpers/verification_unit_selected.js";
import { writeHarnessFile } from "./helpers/verification_wrapper.js";

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
