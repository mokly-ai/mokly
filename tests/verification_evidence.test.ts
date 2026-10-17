import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { validateCiReports } from "../scripts/verification/aggregate.mjs";
import { discoverNodeFiles } from "../scripts/verification/evidence.mjs";
import { validateCompletedReport } from "../scripts/verification/report-validation.mjs";

import { ciReports } from "./helpers/verification_evidence.js";

const root = path.resolve(import.meta.dirname, "..");

test("viewer discovery includes tooling and viewer tests in sorted order", async () => {
  const files = await discoverNodeFiles(root);
  assert.ok(files.includes("tests/verification_evidence.test.ts"));
  assert.ok(files.includes("packages/viewer/tests/nav_rows_render.test.tsx"));
  assert.ok(files.every((file) => /\.test\.tsx?$/.test(file)));
  assert.deepEqual(files, [...new Set(files)].sort());
});

test("aggregate accepts one viewer and four browser reports per runtime", () => {
  for (const runtimes of [["node-22.14.0"], ["node-22.14.0", "node-24"]])
    validateCiReports(ciReports(runtimes), "a".repeat(40), runtimes);
  const reports = ciReports();
  for (const invalid of [
    reports.slice(1),
    [...reports, reports[0]],
    [reports[0], reports[0]],
  ])
    assert.throws(() =>
      validateCiReports(invalid, "a".repeat(40), ["node-22.14.0", "node-24"]),
    );
  assert.throws(
    () => validateCiReports(reports, "main", ["node-22.14.0"]),
    /full lowercase Git SHA/,
  );
});

test("viewer evidence rejects incomplete inventories and unsuccessful test runs", () => {
  const report = ciReports()[0]!;
  for (const mutation of [
    { suite: "unit" },
    { shard: { index: 1, total: 4 } },
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

test("browser evidence rejects missing tests, overlaps, skips and mixed runtimes", () => {
  const validate = (reports: ReturnType<typeof ciReports>) =>
    validateCiReports(reports, "a".repeat(40), ["node-22.14.0"]);
  for (const change of [
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.observedTests!.pop();
    },
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.assignedFiles = reports[2]!.assignedFiles;
    },
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.observedTests![0]!.status = "skipped";
    },
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.nodeVersion = "22.15.0";
    },
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.playwrightFiles!.push("tests/browser/extra.spec.ts");
    },
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.shard = { index: 2, total: 4 };
    },
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.reporterComplete = false;
    },
    (reports: ReturnType<typeof ciReports>) => {
      reports[1]!.observedTests![0]!.errors.push({ message: "frame failed" });
    },
  ]) {
    const reports = structuredClone(ciReports(["node-22.14.0"]));
    change(reports);
    assert.throws(() => validate(reports));
  }
});

test("aggregate names the failing browser runtime and shard detail", () => {
  const reports = ciReports(["node-22.14.0"]);
  reports[1]!.reporterComplete = false;
  assert.throws(
    () => validateCiReports(reports, "a".repeat(40), ["node-22.14.0"]),
    {
      message:
        "browser node-22.14.0 evidence failed: reporter did not complete",
    },
  );
});
