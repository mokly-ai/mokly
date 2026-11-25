import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { copiedHostSpecs } from "./browser-host-needs.mjs";
import {
  browserFileArguments,
  selectBrowserShard,
} from "./browser-partition.mjs";
import weights from "./browser-shard-weights.json" with { type: "json" };
import { parseShardArgument } from "./browser-shard.mjs";
import { browserWorkerCount } from "./concurrency.mjs";
import {
  defaultReportPath,
  readReport,
  verificationIdentity,
  writeReport,
} from "./evidence.mjs";
import { discoverBrowserTests, summarizeObservedFiles } from "./playwright.mjs";
import { requirePrepared } from "./prepared.mjs";
import { runInherited } from "./process.mjs";
import { validateCompletedReport } from "./report-validation.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const suite = "browser";
const project = "chromium";
const shard = parseShardArgument(process.argv.slice(2));
const environment = process.env;
const workers = browserWorkerCount(environment);
const identity = await verificationIdentity(repositoryRoot);
const reportPath =
  process.env.MOKLY_VERIFICATION_REPORT ??
  defaultReportPath(repositoryRoot, suite, shard);
const eventPath = `${reportPath}.events`;
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await Promise.all([
  fs.rm(reportPath, { force: true }),
  fs.rm(eventPath, { force: true }),
]);
await requirePrepared(repositoryRoot, { browser: true });
const full = await discoverBrowserTests(repositoryRoot, { project });
const complete = full;
const assigned = shard
  ? selectBrowserShard(
      full,
      shard,
      weights,
      await copiedHostSpecs(repositoryRoot, full.files),
    )
  : full;
// Global setup skips the copied static example when no assigned spec needs it.
const copiedHost = !shard || assigned.copiedHost;

const args = [
  path.join(repositoryRoot, "node_modules/@playwright/test/cli.js"),
  "test",
  `--project=${project}`,
  "--reporter=./scripts/verification/playwright-reporter.mjs",
];
if (shard) args.push(...browserFileArguments(assigned.files));
console.log(`${suite} Playwright workers: ${workers}`);
console.log(`${suite} copied static example: ${copiedHost ? "build" : "skip"}`);
const started = performance.now();
let evidenceError;
let outcome;
try {
  outcome = await runInherited(process.execPath, args, {
    cwd: repositoryRoot,
    env: playwrightEnvironment(),
  });
} catch (error) {
  evidenceError = error;
  outcome = { exitCode: null, signal: null, interrupted: null };
}

let raw;
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
  evidenceError ??= error;
  raw ??= { observedTests: [] };
}
const observedTests = raw.observedTests ?? [];
const observedFiles = summarizeObservedFiles(observedTests);
const skipped = observedTests.filter(
  (test) => test.status === "skipped",
).length;
const cancelled = observedTests.filter((test) =>
  ["interrupted", "cancelled"].includes(test.status),
).length;
const report = {
  schemaVersion: 1,
  suite,
  ...identity,
  shard: shard ?? null,
  playwrightFiles: complete.files,
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
if (report.outcome.status !== "passed") process.exitCode = 1;

function requireSameIds(expected, actual, label) {
  const ids = (tests) =>
    tests
      .map((test) => test.id)
      .sort()
      .join("\n");
  if (!Array.isArray(actual) || ids(expected) !== ids(actual))
    throw new Error(`${label} do not match independent discovery`);
}

/** The runner alone decides whether global setup builds the copied example. */
function playwrightEnvironment() {
  const child = { ...environment, MOKLY_PLAYWRIGHT_EVENT_REPORT: eventPath };
  if (copiedHost) delete child.MOKLY_PLAYWRIGHT_COPIED_HOST;
  else child.MOKLY_PLAYWRIGHT_COPIED_HOST = "skip";
  return child;
}
