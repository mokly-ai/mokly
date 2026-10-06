import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  browserWorkerCount,
  playwrightSuiteEnvironment,
} from "./concurrency.mjs";
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
const { suite, project, shard } = browserArguments(process.argv.slice(2));
const environment = playwrightSuiteEnvironment(suite);
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
await requirePrepared(repositoryRoot);
const complete = await discoverBrowserTests(repositoryRoot);
const full = await discoverBrowserTests(repositoryRoot, { project });
const assigned = shard
  ? await discoverBrowserTests(repositoryRoot, { project, shard })
  : full;

const args = [
  path.join(repositoryRoot, "node_modules/@playwright/test/cli.js"),
  "test",
  `--project=${project}`,
  "--reporter=./scripts/verification/playwright-reporter.mjs",
];
if (shard) args.push(`--shard=${shard.index}/${shard.total}`);
console.log(`${suite} Playwright workers: ${workers}`);
const started = performance.now();
const outcome = await runInherited(process.execPath, args, {
  cwd: repositoryRoot,
  env: { ...environment, MOKLY_PLAYWRIGHT_EVENT_REPORT: eventPath },
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

function browserArguments(args) {
  let suite = "browser";
  let remaining = args;
  if (remaining[0] === "--suite") {
    suite = remaining[1];
    remaining = remaining.slice(2);
  }
  if (!["browser", "hydration"].includes(suite))
    throw new Error("browser suite must be browser or hydration");
  const shard = parseShardArgument(remaining);
  if (suite === "hydration" && shard)
    throw new Error("hydration suite does not support --shard");
  return {
    suite,
    project: suite === "hydration" ? "hydration" : "chromium",
    shard,
  };
}

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
