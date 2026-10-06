import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createSelectedHarness,
  runSelected,
} from "./helpers/verification_unit_selected.js";
import { writeHarnessFile } from "./helpers/verification_wrapper.js";

const mutations = [
  ["missing file", "summaries.push(event.data)", "summaries.push()"],
  [
    "unexpected file",
    "summaries.push(event.data)",
    'summaries.push(event.data, { ...event.data, file: event.data.file.replace("passing.test.ts", "unexpected.test.ts") })',
  ],
  [
    "incomplete reporter",
    "reporterComplete = true;",
    "reporterComplete = false;",
  ],
  [
    "absent reporter output",
    "fs.writeFileSync(",
    "if (false) fs.writeFileSync(",
  ],
  [
    "invalid reporter output",
    "JSON.stringify({ reporterComplete, summaries, failures }, null, 2)",
    '"invalid reporter JSON"',
  ],
  [
    "invalid test count",
    "summaries.push(event.data)",
    'summaries.push({ ...event.data, counts: { ...event.data.counts, tests: "invalid" } })',
  ],
  [
    "null test count",
    "summaries.push(event.data)",
    "summaries.push({ ...event.data, counts: { ...event.data.counts, tests: null } })",
  ],
  [
    "null failure count",
    "summaries.push(event.data)",
    "summaries.push({ ...event.data, counts: { ...event.data.counts, failed: null } })",
  ],
  [
    "cancelled tests",
    "summaries.push(event.data)",
    "summaries.push({ ...event.data, counts: { ...event.data.counts, cancelled: 1 } })",
  ],
  [
    "failed tests with a zero exit",
    "summaries.push(event.data)",
    "summaries.push({ ...event.data, counts: { ...event.data.counts, failed: 1 } })",
  ],
] as const;

for (const [label, before, after] of mutations) {
  test("selected evidence fails closed on " + label, async (context) => {
    const harness = await createSelectedHarness(context);
    const reporter = path.join(
      harness.root,
      "scripts/verification/node-reporter.mjs",
    );
    const source = await fs.readFile(reporter, "utf8");
    assert.ok(source.includes(before));
    await fs.writeFile(reporter, source.replace(before, after));
    await assert.rejects(runSelected(harness, ["tests/passing.test.ts"]));
  });
}

test("selected execution fails on a signalled test process", async (context) => {
  const harness = await createSelectedHarness(context);
  await writeHarnessFile(
    harness.root,
    "tests/passing.test.ts",
    'import test from "node:test";\ntest("signal", () => process.kill(process.pid, "SIGTERM"));\n',
  );
  await assert.rejects(runSelected(harness, ["tests/passing.test.ts"]));
});
