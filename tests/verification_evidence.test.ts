import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { validateCiReports } from "../scripts/verification/aggregate.mjs";
import {
  discoverUnitFiles,
  nodeShardFiles,
  parseShardArgument,
} from "../scripts/verification/evidence.mjs";
import {
  validateCompletedReport,
  validateShardReports,
} from "../scripts/verification/report-validation.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import {
  browserTest,
  ciReports,
  unitReport,
} from "./helpers/verification_evidence.js";

test("verification discovers the live unit inventory without browser specs", async () => {
  const files = await discoverUnitFiles(repositoryRoot);

  assert.ok(files.includes("tests/verification_evidence.test.ts"));
  assert.ok(files.includes("packages/viewer/tests/server.test.tsx"));
  assert.equal(
    files.some((file) => file.endsWith(".spec.ts")),
    false,
  );
  assert.deepEqual(files, [...files].sort());
  assert.equal(new Set(files).size, files.length);
  for (const file of files)
    assert.equal(
      (await fs.stat(path.join(repositoryRoot, file))).isFile(),
      true,
    );
});

test("verification shard arguments are exact and one based", () => {
  assert.equal(parseShardArgument([]), undefined);
  assert.deepEqual(parseShardArgument(["--shard", "2/4"]), {
    index: 2,
    total: 4,
  });
  for (const args of [
    ["--other", "1/4"],
    ["--shard"],
    ["--shard", "0/4"],
    ["--shard", "5/4"],
    ["--shard", "1/0"],
    ["--shard", "1/9999999999999999999999999"],
    ["--shard", "1/4", "extra"],
  ]) {
    assert.throws(() => parseShardArgument(args), /INDEX\/TOTAL|usage/i);
  }
});

test("Node shard assignments use its ordered round-robin file partition", () => {
  const files = ["a", "b", "c", "d", "e", "f", "g"];
  assert.deepEqual(nodeShardFiles(files, { index: 1, total: 4 }), ["a", "e"]);
  assert.deepEqual(nodeShardFiles(files, { index: 2, total: 4 }), ["b", "f"]);
  assert.deepEqual(nodeShardFiles(files, { index: 3, total: 4 }), ["c", "g"]);
  assert.deepEqual(nodeShardFiles(files, { index: 4, total: 4 }), ["d"]);
});

test("completed reports reject missing execution and non-passing evidence", () => {
  const report = unitReport(1, ["tests/a.test.ts"]);
  validateCompletedReport(report);

  for (const change of [
    { observedFiles: [] },
    { skipped: 1 },
    { cancelled: 1 },
    { reporterComplete: false },
    { reporterErrors: ["reporter failed"] },
    { outcome: { exitCode: 1, signal: null, status: "failed" } },
  ]) {
    assert.throws(
      () => validateCompletedReport({ ...report, ...change }),
      /cancelled|exit|observed|reporter|skipped|status/i,
    );
  }
});

test("developer unit reports tolerate skips without relaxing completion", () => {
  const report = { ...unitReport(1, ["tests/a.test.ts"]), skipped: 2 };
  assert.throws(() => validateCompletedReport(report), /skipped tests/u);
  assert.doesNotThrow(() =>
    validateCompletedReport(report, { allowUnitSkips: true }),
  );
  for (const change of [
    { observedFiles: [] },
    { cancelled: 1 },
    { failures: ["failed test"] },
    { outcome: { exitCode: 1, signal: null, status: "failed" } },
  ])
    assert.throws(() =>
      validateCompletedReport(
        { ...report, ...change },
        { allowUnitSkips: true },
      ),
    );
});

test("four shard reports require disjoint complete current evidence", () => {
  const files = [
    "tests/a.test.ts",
    "tests/b.test.ts",
    "tests/c.test.ts",
    "tests/d.test.ts",
  ];
  const reports = files.map((file, index) =>
    unitReport(index + 1, [file], files),
  );
  validateShardReports(reports, {
    commit: "a".repeat(40),
    runtime: "node-24.21.0",
    suite: "unit",
    total: 4,
  });

  assert.throws(
    () =>
      validateShardReports(reports.slice(0, 3), {
        commit: "a".repeat(40),
        runtime: "node-24.21.0",
        suite: "unit",
        total: 4,
      }),
    /missing|four|4/i,
  );
  assert.throws(
    () =>
      validateShardReports(
        [
          reports[0]!,
          { ...reports[1]!, assignedFiles: [files[0]!] },
          ...reports.slice(2),
        ],
        {
          commit: "a".repeat(40),
          runtime: "node-24.21.0",
          suite: "unit",
          total: 4,
        },
      ),
    /duplicate|observed|union/i,
  );
  assert.throws(
    () =>
      validateShardReports(
        [{ ...reports[0]!, commit: "b".repeat(40) }, ...reports.slice(1)],
        {
          commit: "a".repeat(40),
          runtime: "node-24.21.0",
          suite: "unit",
          total: 4,
        },
      ),
    /commit/i,
  );
  assert.throws(
    () =>
      validateShardReports(
        reports.map((report) => ({ ...report, nodeVersion: "22.14.0" })),
        {
          commit: "a".repeat(40),
          runtime: "node-24.21.0",
          suite: "unit",
          total: 4,
        },
      ),
    /runtime|version/i,
  );
});

test("browser shard evidence requires every independently discovered test once", () => {
  const files = ["tests/browser/a.spec.ts", "tests/browser/b.spec.ts"];
  const tests = [browserTest("one", files[0]!), browserTest("two", files[1]!)];
  const reports = [1, 2, 3, 4].map((index) => ({
    ...unitReport(index, index < 3 ? [files[index - 1]!] : [], files),
    suite: "browser",
    fullTests: tests,
    assignedTests: index < 3 ? [tests[index - 1]!] : [],
    observedTests:
      index < 3
        ? [
            {
              ...tests[index - 1]!,
              durationMs: 1,
              status: "passed",
              errors: [],
            },
          ]
        : [],
  }));
  assert.throws(
    () =>
      validateShardReports(reports, {
        commit: "a".repeat(40),
        runtime: "node-24.21.0",
        suite: "browser",
        total: 4,
      }),
    /empty/i,
  );

  const browserFiles = ["a", "b", "c", "d"].map(
    (name) => `tests/browser/${name}.spec.ts`,
  );
  const browserTests = browserFiles.map((file, index) =>
    browserTest(String(index), file),
  );
  const complete = browserTests.map((item, index) => ({
    ...unitReport(index + 1, [item.file], browserFiles),
    suite: "browser",
    fullTests: browserTests,
    assignedTests: [item],
    observedTests: [{ ...item, durationMs: 1, status: "passed", errors: [] }],
  }));
  validateShardReports(complete, {
    commit: "a".repeat(40),
    runtime: "node-24.21.0",
    suite: "browser",
    total: 4,
  });
  assert.throws(
    () =>
      validateShardReports(
        [{ ...complete[0]!, observedTests: [] }, ...complete.slice(1)],
        {
          commit: "a".repeat(40),
          runtime: "node-24.21.0",
          suite: "browser",
          total: 4,
        },
      ),
    /observed|test/i,
  );
});

test("the CI aggregate requires every runtime, suite, shard, and commit", () => {
  const ordinaryRuntimes = ["node-22.14.0"];
  const releaseRuntimes = ["node-22.14.0", "node-24"];
  const reports = ciReports(releaseRuntimes);
  validateCiReports(reports, "a".repeat(40), releaseRuntimes);
  assert.throws(
    () => validateCiReports(reports.slice(1), "a".repeat(40), releaseRuntimes),
    /expected 16|missing/i,
  );
  assert.throws(
    () =>
      validateCiReports(
        [{ ...reports[0]!, runtime: "node-23" }, ...reports.slice(1)],
        "a".repeat(40),
        releaseRuntimes,
      ),
    /unexpected|runtime/i,
  );
  assert.throws(
    () => validateCiReports(reports, "b".repeat(40), releaseRuntimes),
    /commit/i,
  );

  const ordinaryReports = ciReports(ordinaryRuntimes);
  validateCiReports(ordinaryReports, "a".repeat(40), ordinaryRuntimes);
  assert.throws(
    () => validateCiReports(reports, "a".repeat(40), ordinaryRuntimes),
    /expected 8|extra/i,
  );
  for (const unsupported of [
    [],
    ["node-24"],
    ["node-22.14.0", "node-22.14.0"],
    ["node-22.14.0", "node-23"],
  ]) {
    assert.throws(
      () => validateCiReports(ordinaryReports, "a".repeat(40), unsupported),
      /runtime profile/i,
    );
  }
});
