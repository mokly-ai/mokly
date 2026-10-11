import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createSelectedHarness,
  runSelected,
} from "./helpers/verification_unit_selected.js";
import {
  runWrapper,
  writeHarnessFile,
} from "./helpers/verification_wrapper.js";

for (const [source, expected] of [
  [
    'import { describe, test } from "node:test"; describe("parent", () => { test("child", () => { throw new Error("bad"); }); });',
    "1 selected unit test failed:\n✖ child\n",
  ],
  [
    'import test from "node:test"; test("slow", { timeout: 10 }, () => new Promise(() => {}));',
    "1 selected unit test cancelled:\n✖ slow\n",
  ],
  [
    'import { describe, before, test } from "node:test"; describe("hook suite", () => { before(() => { throw new Error("hook"); }); test("child one", () => {}); test("child two", () => {}); });',
    "1 selected unit test failed:\n✖ hook suite\n2 selected unit tests cancelled:\n✖ child one\n✖ child two\n",
  ],
] as const) {
  test(
    "selected outcome groups: " + expected.split("\n")[1],
    async (context) => {
      const harness = await createSelectedHarness(context);
      await writeHarnessFile(harness.root, "tests/passing.test.ts", source);
      await assert.rejects(
        runSelected(harness, ["tests/passing.test.ts"]),
        (error: Error & { stderr: string; code: number }) => {
          assert.equal(error.code, 1);
          assert.equal(error.stderr, expected);
          assert.doesNotMatch(error.stderr, / {4}at |Node\.js v/u);
          return true;
        },
      );
    },
  );
}

test("broken import and timeout show both groups with load and cancelled names", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/broken.test.ts",
    'import "./missing-dependency.js";',
  );
  await writeHarnessFile(
    harness.root,
    "tests/passing.test.ts",
    'import test from "node:test"; test("slow", { timeout: 10 }, () => new Promise(() => {}));',
  );
  await assert.rejects(
    runSelected(harness, ["tests/broken.test.ts", "tests/passing.test.ts"]),
    (error: Error & { stderr: string }) => {
      assert.ok(
        error.stderr.endsWith(
          "1 selected unit test failed:\n✖ tests/broken.test.ts\n1 selected unit test cancelled:\n✖ slow\n",
        ),
      );
      return true;
    },
  );
});

for (const status of ["failed", "cancelled"] as const) {
  test(
    "selected counts fail closed without " + status + " names",
    async (context) => {
      const harness = await createSelectedHarness(context);
      const reporter = path.join(
        harness.root,
        "scripts/verification/node-reporter.mjs",
      );
      const source = await fs.readFile(reporter, "utf8");
      await fs.writeFile(
        reporter,
        source.replace(
          "summaries.push(event.data)",
          `summaries.push({ ...event.data, counts: { ...event.data.counts, ${status}: 1 } })`,
        ),
      );
      await assert.rejects(
        runSelected(harness, ["tests/passing.test.ts"]),
        (error: Error & { stderr: string }) => {
          assert.equal(error.stderr, `1 selected unit test ${status}:\n`);
          return true;
        },
      );
    },
  );
}

test("complete failure entries keep only name and diagnostic", async (context) => {
  const harness = await createSelectedHarness(context);
  const report = path.join(harness.root, "complete.json");
  await assert.rejects(runWrapper(harness.root, "run-unit.mjs", { report }));
  const evidence = JSON.parse(await fs.readFile(report, "utf8"));
  assert.ok(evidence.failures.length > 0);
  for (const failure of evidence.failures)
    assert.deepEqual(Object.keys(failure).sort(), ["diagnostic", "name"]);
  assert.equal(evidence.fileResults, undefined);
});
