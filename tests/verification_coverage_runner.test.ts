import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createCoverageHarness,
  runCoverage,
  runCoverageCommand,
  writeCoverageThresholds,
  writeHarnessFile,
} from "./helpers/coverage_harness.js";

test("the coverage runner maps sources, checks thresholds, and fails closed", async () => {
  const root = await createCoverageHarness();
  try {
    await writeCoverageThresholds(root, {
      lines: 50,
      branches: 50,
      functions: 50,
    });
    const passing = await runCoverage(root, []);
    assert.equal(passing.summary.outcome.status, "passed", passing.stderr);
    assert.equal(passing.summary.complete, true);
    assert.equal(passing.summary.thresholdsChecked, true);
    assert.deepEqual(passing.summary.testFiles, ["tests/subject.test.ts"]);
    assert.deepEqual(passing.summary.findings, []);
    assert.deepEqual(
      passing.summary.files.map((record) => record.file),
      ["src/subject.ts"],
    );
    assert.deepEqual(passing.summary.totals.functions, {
      covered: 1,
      total: 2,
      percent: 50,
    });
    assert.deepEqual(passing.summary.unmapped, []);
    assert.match(passing.stdout, /coverage check passed/u);
    assert.match(passing.stdout, /lowest line coverage/u);
    const lcov = await fs.readFile(
      path.join(root, "coverage/lcov.info"),
      "utf8",
    );
    assert.match(lcov, /^SF:.*src[\\/]subject\.ts$/mu);
    assert.doesNotMatch(lcov, /subject\.test\.ts/u);
    await assert.rejects(fs.stat(path.join(root, "coverage/node-events.json")));
    await assert.rejects(
      fs.stat(path.join(root, "coverage/node-coverage.json")),
    );

    await writeCoverageThresholds(root, {
      lines: 0,
      branches: 0,
      functions: 100,
    });
    const failing = await runCoverage(root, [], 1);
    assert.equal(failing.summary.outcome.status, "failed");
    assert.deepEqual(failing.summary.findings, [
      "functions coverage 50.00% is below the 100.00% threshold",
    ]);
    assert.match(
      failing.stderr,
      /coverage check failed: functions coverage 50\.00% is below the 100\.00% threshold/u,
    );

    const partial = await runCoverage(root, ["tests/subject.test.ts"]);
    assert.equal(partial.summary.outcome.status, "passed");
    assert.equal(partial.summary.complete, false);
    assert.equal(partial.summary.thresholdsChecked, false);
    assert.deepEqual(partial.summary.findings, []);
    assert.match(
      partial.stdout,
      /thresholds: not checked for a partial test selection/u,
    );

    const summaryPath = path.join(root, "coverage/summary.json");
    const partialSummary = await fs.readFile(summaryPath, "utf8");
    const unknown = await runCoverageCommand(root, ["tests/missing.test.ts"]);
    assert.equal(unknown.code, 1);
    assert.match(
      unknown.stderr,
      /tests\/missing\.test\.ts is not a discovered unit test file/u,
    );
    assert.equal(await fs.readFile(summaryPath, "utf8"), partialSummary);

    await writeCoverageThresholds(root, {
      lines: 0,
      branches: 0,
      functions: 0,
    });
    await writeHarnessFile(
      root,
      "tests/failing.test.ts",
      `import test from "node:test";

test("retained coverage failure", () => {
  throw new Error("retained coverage failure sentinel");
});
`,
    );
    const broken = await runCoverage(root, [], 1);
    assert.equal(broken.summary.outcome.status, "failed");
    assert.equal(broken.summary.outcome.exitCode, 1);
    assert.deepEqual(broken.summary.findings, []);
    assert.ok(
      broken.summary.failures.some((failure) =>
        failure.name.includes("retained coverage failure"),
      ),
    );
    assert.match(
      broken.stderr,
      /coverage check failed: the unit tests did not pass/u,
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});

test("the coverage runner fails closed when the coverage reporter is incomplete", async () => {
  const root = await createCoverageHarness();
  try {
    await writeCoverageThresholds(root, {
      lines: 0,
      branches: 0,
      functions: 0,
    });
    await writeHarnessFile(
      root,
      "scripts/verification/coverage-reporter.mjs",
      `export default async function* silentCoverageReporter(source) {
  for await (const event of source) void event;
}
`,
    );
    const silent = await runCoverage(root, [], 1);
    assert.equal(silent.summary.outcome.status, "failed");
    assert.equal(silent.summary.outcome.exitCode, 0);
    assert.deepEqual(silent.summary.findings, []);
    assert.deepEqual(silent.summary.files, []);
    assert.match(
      silent.stderr,
      /coverage check failed: the coverage reporter did not complete/u,
    );
    assert.match(
      silent.stderr,
      /coverage check failed: Node did not report a coverage summary/u,
    );
    assert.doesNotMatch(silent.stderr, /the unit tests did not pass/u);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});

test("the coverage runner runs test files with the unit suite's concurrency", async () => {
  const root = await createCoverageHarness();
  try {
    await writeCoverageThresholds(root, {
      lines: 0,
      branches: 0,
      functions: 0,
    });
    for (const name of ["first", "second"])
      await writeHarnessFile(
        root,
        `tests/${name}_order.test.ts`,
        `import fs from "node:fs";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

test("${name} file", async () => {
  fs.appendFileSync("order.log", "start ${name}\\n");
  await delay(200);
  fs.appendFileSync("order.log", "end ${name}\\n");
});
`,
      );
    const orderPath = path.join(root, "order.log");
    const serial = await runCoverage(root, [], 0, {
      MOKLY_UNIT_CONCURRENCY: "1",
    });
    assert.match(serial.stdout, /^unit test files active at once: 1$/mu);
    const order = (await fs.readFile(orderPath, "utf8")).trim().split("\n");
    assert.equal(order.length, 4, order.join(", "));
    for (let index = 0; index < order.length; index += 2)
      assert.equal(
        order[index + 1],
        order[index]?.replace("start", "end"),
        `one test file at a time: ${order.join(", ")}`,
      );
    await fs.rm(orderPath);

    const summaryPath = path.join(root, "coverage/summary.json");
    const summary = await fs.readFile(summaryPath, "utf8");
    const invalid = await runCoverageCommand(root, [], {
      MOKLY_UNIT_CONCURRENCY: "0",
    });
    assert.equal(invalid.code, 1);
    assert.match(
      invalid.stderr,
      /MOKLY_UNIT_CONCURRENCY must be a positive integer; received 0/u,
    );
    await assert.rejects(fs.stat(orderPath));
    assert.equal(await fs.readFile(summaryPath, "utf8"), summary);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
});
