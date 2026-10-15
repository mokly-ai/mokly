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
  assert.ok(files.includes("packages/viewer/tests/server.test.tsx"));
  assert.ok(files.every((file) => /\.test\.tsx?$/.test(file)));
  assert.deepEqual(files, [...new Set(files)].sort());
});

test("aggregate accepts one viewer report per required runtime", () => {
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
