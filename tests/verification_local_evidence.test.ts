import assert from "node:assert/strict";
import test from "node:test";

import { validateLocalReports } from "../scripts/verification/local-evidence.mjs";

import { ciReports } from "./helpers/verification_evidence.js";

function evidence() {
  const reports = ciReports(["node-24"]);
  const unit = reports.find((report) => report.suite === "unit")!;
  const browser = reports.find((report) => report.suite === "browser")!;
  const hydration = reports.find((report) => report.suite === "hydration")!;
  return {
    reports,
    hydration,
    expected: {
      commit: unit.commit,
      runtime: unit.runtime,
      unitFiles: unit.fullFiles,
      browserTests: browser.fullTests,
      hydrationTests: hydration.fullTests,
    },
  };
}

test("complete local evidence includes four unit and browser shards plus hydration", () => {
  const { reports, expected } = evidence();
  validateLocalReports(reports, expected);
  assert.throws(
    () => validateLocalReports(reports.slice(0, 8), expected),
    /missing/i,
  );
  assert.throws(
    () => validateLocalReports([...reports, reports[0]], expected),
    /extra|duplicate/i,
  );
});

test("local evidence rejects stale, failed, duplicated, and incomplete reports", () => {
  for (const suite of ["unit", "browser", "hydration"]) {
    const { reports, expected } = evidence();
    const report = reports.find((candidate) => candidate.suite === suite)!;
    report.commit = "b".repeat(40);
    assert.throws(() => validateLocalReports(reports, expected), /commit/i);
    report.commit = expected.commit;
    report.observedFiles = [];
    assert.throws(() => validateLocalReports(reports, expected), /observed/i);
  }
  const { reports, expected } = evidence();
  reports[1] = reports[0]!;
  assert.throws(
    () => validateLocalReports(reports, expected),
    /duplicate|identity/i,
  );
});

test("hydration evidence must be unsharded and match independent live discovery", () => {
  const { reports, hydration, expected } = evidence();
  hydration.shard = { index: 1, total: 1 };
  assert.throws(() => validateLocalReports(reports, expected), /unsharded/i);
  hydration.shard = null;
  assert.throws(
    () => validateLocalReports(reports, { ...expected, hydrationTests: [] }),
    /hydration.*discovery/i,
  );
  assert.throws(
    () => validateLocalReports(reports, { ...expected, browserTests: [] }),
    /browser.*discovery/i,
  );
});

test("local Playwright evidence must cover every spec on the same Node version", () => {
  const { reports, hydration, expected } = evidence();
  hydration.playwrightFiles = [
    ...hydration.playwrightFiles!,
    "tests/browser/missing.spec.ts",
  ];
  assert.throws(() => validateLocalReports(reports, expected), /inventories/i);
  hydration.playwrightFiles.pop();
  hydration.nodeVersion = "24.20.0";
  assert.throws(
    () => validateLocalReports(reports, expected),
    /Node versions/i,
  );
});
