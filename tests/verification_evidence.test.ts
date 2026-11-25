import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { validateCiReports } from "../scripts/verification/aggregate.mjs";
import { discoverNodeFiles } from "../scripts/verification/evidence.mjs";
import { validateCompletedReport } from "../scripts/verification/report-validation.mjs";

import { ciReports } from "./helpers/verification_evidence.js";

const root = path.resolve(import.meta.dirname, "..");

test("viewer discovery includes tooling, viewer, UI, and model package tests in sorted order", async () => {
  const files = await discoverNodeFiles(root);
  assert.ok(files.includes("tests/verification_evidence.test.ts"));
  assert.ok(files.includes("packages/viewer/tests/nav_rows_render.test.tsx"));
  assert.ok(files.includes("packages/ui/tests/dom.test.tsx"));
  assert.ok(files.includes("packages/model/tests/paths.test.ts"));
  assert.ok(files.every((file) => /\.test\.tsx?$/.test(file)));
  assert.deepEqual(files, [...new Set(files)].sort());
});

const COMMIT = "a".repeat(40);
const TOTALS = { viewer: 2, browser: 4 } as const;
type Reports = ReturnType<typeof ciReports>;
const shardsOf = (reports: Reports, suite: string) =>
  reports.filter((report) => report.suite === suite);

test("aggregate accepts every viewer and browser shard per runtime", () => {
  for (const runtimes of [["node-22.15.0"], ["node-22.15.0", "node-24"]]) {
    validateCiReports(ciReports(runtimes, TOTALS), COMMIT, runtimes, TOTALS);
    validateCiReports(ciReports(runtimes), COMMIT, runtimes);
  }
  const reports = ciReports(undefined, TOTALS);
  for (const invalid of [
    reports.slice(1),
    [...reports, reports[0]],
    [reports[0], reports[0]],
  ])
    assert.throws(() =>
      validateCiReports(invalid, COMMIT, ["node-22.15.0", "node-24"], TOTALS),
    );
  assert.throws(
    () => validateCiReports(reports, "main", ["node-22.15.0"], TOTALS),
    /full lowercase Git SHA/,
  );
  assert.throws(
    () =>
      validateCiReports(reports, COMMIT, ["node-22.15.0", "node-24"], {
        viewer: 3,
        browser: 4,
      }),
    { message: "missing or extra CI evidence: expected 14 reports" },
  );
});

test("viewer evidence rejects incomplete inventories and unsuccessful test runs", () => {
  const report = ciReports(undefined, TOTALS)[0]!;
  for (const mutation of [
    { suite: "unit" },
    { observedFiles: [] },
    { fullFiles: [] },
    { assignedFiles: ["another.test.ts"] },
    { skipped: 1 },
    { cancelled: 1 },
    { reporterComplete: false },
    { reporterErrors: ["report error"] },
    { failures: ["test failure"] },
    { outcome: { status: "failed", exitCode: 1, signal: null } },
    { runtime: "node-24" },
    { observedFiles: [{ file: report.fullFiles[0], tests: 0, durationMs: 1 }] },
  ])
    assert.throws(() => validateCompletedReport({ ...report, ...mutation }));
  validateCompletedReport(report);
});

test("viewer shards reject unsharded, wrong-shard, overlapping, and missing files", () => {
  const validate = (reports: Reports) =>
    validateCiReports(reports, COMMIT, ["node-22.15.0"], TOTALS);
  for (const [change, message] of [
    [
      (viewer: Reports) => {
        viewer[1]!.shard = null;
      },
      /viewer node-22\.15\.0 evidence failed: unsharded files do not match/,
    ],
    [
      (viewer: Reports) => {
        viewer[1]!.shard = { index: 2, total: 3 };
      },
      /viewer node-22\.15\.0 evidence failed: missing, duplicate, or invalid shard identity/,
    ],
    [
      (viewer: Reports) => {
        viewer[1]!.shard = { index: 1, total: 2 };
      },
      /viewer node-22\.15\.0 evidence failed: missing, duplicate, or invalid shard identity/,
    ],
    [
      (viewer: Reports) => {
        viewer[1]!.assignedFiles = viewer[0]!.assignedFiles;
        viewer[1]!.observedFiles = viewer[0]!.observedFiles;
      },
      /viewer node-22\.15\.0 evidence failed: .*file assignments/,
    ],
    [
      (viewer: Reports) => {
        viewer[1]!.assignedFiles = viewer[1]!.assignedFiles.slice(1);
        viewer[1]!.observedFiles = viewer[1]!.observedFiles.slice(1);
      },
      /viewer node-22\.15\.0 evidence failed: .*file assignments/,
    ],
  ] as const) {
    const reports = structuredClone(ciReports(["node-22.15.0"], TOTALS));
    change(shardsOf(reports, "viewer"));
    assert.throws(() => validate(reports), { message });
  }
});

test("browser evidence rejects missing tests, overlaps, skips and mixed runtimes", () => {
  const validate = (reports: Reports) =>
    validateCiReports(reports, COMMIT, ["node-22.15.0"], TOTALS);
  for (const change of [
    (browser: Reports) => {
      browser[0]!.observedTests!.pop();
    },
    (browser: Reports) => {
      browser[0]!.assignedFiles = browser[1]!.assignedFiles;
    },
    (browser: Reports) => {
      browser[0]!.observedTests![0]!.status = "skipped";
    },
    (browser: Reports) => {
      browser[0]!.nodeVersion = "22.16.0";
    },
    (browser: Reports) => {
      browser[0]!.playwrightFiles!.push("tests/browser/extra.spec.ts");
    },
    (browser: Reports) => {
      browser[0]!.shard = { index: 2, total: 4 };
    },
    (browser: Reports) => {
      browser[0]!.reporterComplete = false;
    },
    (browser: Reports) => {
      browser[0]!.observedTests![0]!.errors.push({ message: "frame failed" });
    },
  ]) {
    const reports = structuredClone(ciReports(["node-22.15.0"], TOTALS));
    change(shardsOf(reports, "browser"));
    assert.throws(() => validate(reports));
  }
});

test("aggregate rejects a viewer and browser Node version mismatch", () => {
  const runtimes = ["node-22.15.0", "node-24"];
  const reports = structuredClone(ciReports(runtimes, TOTALS));
  for (const report of shardsOf(reports, "browser"))
    if (report.runtime === "node-24") report.nodeVersion = "24.22.0";
  assert.throws(() => validateCiReports(reports, COMMIT, runtimes, TOTALS), {
    message: "suites used different Node versions",
  });
});

test("aggregate names the failing browser runtime and shard detail", () => {
  const reports = ciReports(["node-22.15.0"], TOTALS);
  shardsOf(reports, "browser")[0]!.reporterComplete = false;
  assert.throws(
    () => validateCiReports(reports, COMMIT, ["node-22.15.0"], TOTALS),
    {
      message:
        "browser node-22.15.0 evidence failed: reporter did not complete",
    },
  );
});
