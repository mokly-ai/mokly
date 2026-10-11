import assert from "node:assert/strict";
import test from "node:test";

import { validateCiReports } from "../scripts/verification/aggregate.mjs";
import { validateShardReports } from "../scripts/verification/report-validation.mjs";
import { BROWSER_SHARD_SHARE_LIMIT } from "../scripts/verification/shard-balance.mjs";

import {
  browserTest,
  ciReports,
  unitReport,
} from "./helpers/verification_evidence.js";

const commit = "a".repeat(40);
const files = [1, 2, 3, 4].map(
  (index) => `tests/browser/shard-${index}.spec.ts`,
);
const playwrightFiles = [...files, "tests/browser/shell_hydration.spec.ts"];

/** Four browser shard reports; each shard holds one spec with `counts[i]` tests. */
function browserShards(counts: readonly number[], runtime = "node-24.21.0") {
  const assigned = counts.map((count, shard) =>
    Array.from({ length: count }, (_, index) =>
      browserTest(`${shard + 1}-${index}`, files[shard]!),
    ),
  );
  const fullTests = assigned.flat();
  return assigned.map((tests, shard) => ({
    ...unitReport(shard + 1, [files[shard]!], files),
    runtime,
    nodeVersion: runtime === "node-22.14.0" ? "22.14.0" : "24.21.0",
    suite: "browser",
    playwrightFiles,
    fullTests,
    assignedTests: tests,
    observedTests: tests.map((entry) => ({
      ...entry,
      durationMs: 1,
      status: "passed",
      errors: [],
    })),
  }));
}

function validateBrowser(counts: readonly number[]) {
  validateShardReports(browserShards(counts), {
    commit,
    runtime: "node-24.21.0",
    suite: "browser",
    total: 4,
  });
}

test("balanced browser shards pass the share limit", () => {
  assert.doesNotThrow(() => validateBrowser([3, 3, 2, 2]));
});

test("a browser shard exactly at the share limit passes", () => {
  assert.equal(BROWSER_SHARD_SHARE_LIMIT, 1.25);
  assert.doesNotThrow(() => validateBrowser([4, 2, 2, 2]));
});

test("a browser shard above the share limit names a split", () => {
  assert.throws(() => validateBrowser([2, 5, 2, 1]), {
    message:
      "browser shard 2/4 holds 5 of 10 tests, above the limit of 4; split a large spec into smaller spec files",
  });
});

test("the CI aggregate applies the share limit to browser evidence", () => {
  const runtime = "node-22.14.0";
  const reports = [
    ...ciReports([runtime]).filter((report) => report.suite !== "browser"),
    ...browserShards([3, 1, 1, 1], runtime),
  ];
  assert.throws(() => validateCiReports(reports, commit, [runtime]), {
    message: `browser ${runtime} evidence failed: browser shard 1/4 holds 3 of 6 tests, above the limit of 2; split a large spec into smaller spec files`,
  });
});

test("unit shards are not subject to the share limit, even with skewed tests", () => {
  const reports = browserShards([7, 1, 1, 1]).map((report) => ({
    ...report,
    suite: "unit",
  }));
  assert.doesNotThrow(() =>
    validateShardReports(reports, {
      commit,
      runtime: "node-24.21.0",
      suite: "unit",
      total: 4,
    }),
  );
  assert.throws(
    () =>
      validateShardReports(browserShards([7, 1, 1, 1]), {
        commit,
        runtime: "node-24.21.0",
        suite: "browser",
        total: 4,
      }),
    /browser shard 1\/4 holds 7 of 10 tests, above the limit of 4/u,
  );
});
