import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  defaultReportPath,
  parseShardArgument,
  readReport,
  verificationIdentity,
  writeReport,
} from "./evidence.mjs";
import { discoverBrowserTests } from "./playwright.mjs";
import { requirePrepared } from "./prepared.mjs";
import { runInherited } from "./process.mjs";
import { validateCompletedReport } from "./report-validation.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const shard = parseShardArgument(process.argv.slice(2));
const identity = await verificationIdentity(repositoryRoot);
const reportPath =
  process.env.MOKLY_VERIFICATION_REPORT ??
  defaultReportPath(repositoryRoot, "browser", shard);
const eventPath = `${reportPath}.events`;
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await Promise.all([
  fs.rm(reportPath, { force: true }),
  fs.rm(eventPath, { force: true }),
]);
await requirePrepared(repositoryRoot);
const full = await discoverBrowserTests(repositoryRoot);
const assigned = shard
  ? await discoverBrowserTests(repositoryRoot, shard)
  : full;

const args = [
  path.join(repositoryRoot, "node_modules/@playwright/test/cli.js"),
  "test",
  "--reporter=./scripts/verification/playwright-reporter.mjs",
];
if (shard) args.push(`--shard=${shard.index}/${shard.total}`);
const started = performance.now();
const outcome = await runInherited(process.execPath, args, {
  cwd: repositoryRoot,
  env: { ...process.env, MOKLY_PLAYWRIGHT_EVENT_REPORT: eventPath },
});

let raw;
let evidenceError;
try {
  raw = await readReport(eventPath);
  if (raw.reporterComplete !== true)
    throw new Error("Playwright reporter did not complete");
  if (!Array.isArray(raw.errors) || raw.errors.length > 0)
    throw new Error(
      `Playwright reporter errors: ${(raw.errors ?? []).join("; ")}`,
    );
  requireSameIds(
    assigned.tests,
    raw.assignedTests,
    "Playwright assigned tests",
  );
} catch (error) {
  evidenceError = error;
  raw = { observedTests: [] };
}
const observedTests = raw.observedTests ?? [];
const observedFiles = summarizeFiles(observedTests);
const skipped = observedTests.filter(
  (test) => test.status === "skipped",
).length;
const cancelled = observedTests.filter((test) =>
  ["interrupted", "cancelled"].includes(test.status),
).length;
const report = {
  schemaVersion: 1,
  suite: "browser",
  ...identity,
  shard: shard ?? null,
  fullFiles: full.files,
  assignedFiles: assigned.files,
  observedFiles,
  fullTests: full.tests,
  assignedTests: assigned.tests,
  observedTests,
  skipped,
  cancelled,
  reporterComplete: raw.reporterComplete === true,
  reporterErrors: raw.errors ?? ["Playwright reporter output was unavailable"],
  durationMs: performance.now() - started,
  outcome: {
    exitCode: outcome.exitCode,
    signal: outcome.signal ?? outcome.interrupted,
    status:
      outcome.exitCode === 0 &&
      outcome.signal === null &&
      outcome.interrupted === null &&
      raw.status === "passed" &&
      !evidenceError
        ? "passed"
        : "failed",
  },
};
try {
  validateCompletedReport(report);
} catch (error) {
  evidenceError ??= error;
  report.outcome.status = "failed";
}
await writeReport(reportPath, report);
await fs.rm(eventPath, { force: true });
if (evidenceError) throw evidenceError;

function summarizeFiles(tests) {
  const files = new Map();
  for (const test of tests) {
    const entry = files.get(test.file) ?? {
      file: test.file,
      durationMs: 0,
      tests: 0,
    };
    entry.durationMs += test.durationMs;
    entry.tests += 1;
    files.set(test.file, entry);
  }
  return [...files.values()].sort((left, right) =>
    left.file.localeCompare(right.file),
  );
}

function requireSameIds(expected, actual, label) {
  const ids = (tests) =>
    tests
      .map((test) => test.id)
      .sort()
      .join("\n");
  if (!Array.isArray(actual) || ids(expected) !== ids(actual))
    throw new Error(`${label} do not match independent discovery`);
}
