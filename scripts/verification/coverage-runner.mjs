import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { unitTestConcurrency } from "./concurrency.mjs";
import {
  coverageIncludeGlobs,
  evaluateThresholds,
  formatCoverageSummary,
  parseThresholds,
  selectCoverageFiles,
  summarizeCoverage,
} from "./coverage.mjs";
import {
  discoverUnitFiles,
  readReport,
  verificationIdentity,
  writeReport,
} from "./evidence.mjs";
import { requirePrepared } from "./prepared.mjs";
import { runInherited } from "./process.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/** Reviewed minimum percentages that a complete run must reach. */
const COVERAGE_THRESHOLDS_FILE =
  "scripts/verification/coverage-thresholds.json";

/** Ignored directory that receives the lcov report and JSON summary. */
const COVERAGE_OUTPUT_DIRECTORY = "coverage";

/**
 * Run discovered unit tests with Node's coverage and check the thresholds.
 *
 * The command is a local developer tool: it is not part of `cargo xtask
 * check` or hosted CI. It returns the written summary; the caller decides the
 * process exit code from `summary.outcome.status`.
 */
export async function runCoverageVerification(argv) {
  const fullFiles = await discoverUnitFiles(repositoryRoot);
  if (fullFiles.length === 0) throw new Error("unit test discovery was empty");
  const selection = selectCoverageFiles(fullFiles, argv);
  const concurrency = unitTestConcurrency();
  const thresholds = parseThresholds(
    JSON.parse(
      await fs.readFile(
        path.join(repositoryRoot, COVERAGE_THRESHOLDS_FILE),
        "utf8",
      ),
    ),
  );
  await requirePrepared(repositoryRoot);
  const identity = await verificationIdentity(repositoryRoot);
  const output = path.join(repositoryRoot, COVERAGE_OUTPUT_DIRECTORY);
  await fs.rm(output, { force: true, recursive: true });
  await fs.mkdir(output, { recursive: true });
  const eventPath = path.join(output, "node-events.json");
  const coveragePath = path.join(output, "node-coverage.json");
  console.log(`unit test files active at once: ${concurrency}`);
  const started = performance.now();
  const outcome = await runInherited(
    process.execPath,
    testArguments(selection, concurrency),
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        MOKLY_COVERAGE_LCOV: path.join(output, "lcov.info"),
        MOKLY_COVERAGE_REPORT: coveragePath,
        MOKLY_NODE_EVENT_REPORT: eventPath,
        NODE_OPTIONS: appendNodeOption(
          process.env.NODE_OPTIONS,
          "--enable-source-maps",
        ),
      },
    },
  );
  const passed =
    outcome.exitCode === 0 &&
    outcome.signal === null &&
    outcome.interrupted === null;
  const events = await readOptionalReport(eventPath);
  const raw = await readOptionalReport(coveragePath);
  await Promise.all([
    fs.rm(eventPath, { force: true }),
    fs.rm(coveragePath, { force: true }),
  ]);
  const problems = [];
  if (!passed) problems.push("the unit tests did not pass");
  if (events?.reporterComplete !== true)
    problems.push("the Node evidence reporter did not complete");
  if (raw?.reporterComplete !== true)
    problems.push("the coverage reporter did not complete");
  if (!raw?.summary) problems.push("Node did not report a coverage summary");
  const coverage = raw?.summary
    ? summarizeCoverage(raw.summary, repositoryRoot)
    : { files: [], totals: {}, unmapped: [] };
  const findings =
    selection.complete && raw?.summary
      ? evaluateThresholds(coverage.totals, thresholds)
      : [];
  problems.push(...findings);
  const summary = {
    schemaVersion: 1,
    suite: "coverage",
    ...identity,
    complete: selection.complete,
    testFiles: selection.files,
    thresholds,
    thresholdsChecked: selection.complete,
    findings,
    totals: coverage.totals,
    files: coverage.files,
    unmapped: coverage.unmapped,
    skipped: skippedTests(events),
    failures: events?.failures ?? [],
    durationMs: performance.now() - started,
    outcome: {
      exitCode: outcome.exitCode,
      signal: outcome.signal ?? outcome.interrupted,
      status: problems.length === 0 ? "passed" : "failed",
    },
  };
  await writeReport(path.join(output, "summary.json"), summary);
  report(summary, coverage, problems);
  return summary;
}

function testArguments(selection, concurrency) {
  const args = [
    "--import",
    "tsx",
    "--test",
    `--test-concurrency=${concurrency}`,
    "--experimental-test-coverage",
    ...coverageIncludeGlobs().map((glob) => `--test-coverage-include=${glob}`),
    "--test-reporter=./scripts/verification/node-reporter.mjs",
    "--test-reporter-destination=stdout",
    "--test-reporter=./scripts/verification/coverage-reporter.mjs",
    "--test-reporter-destination=stdout",
  ];
  args.push(...selection.files);
  return args;
}

function report(summary, coverage, problems) {
  if (summary.totals.lines) {
    for (const line of formatCoverageSummary(coverage)) console.log(line);
  }
  console.log(`unit tests skipped or todo: ${summary.skipped}`);
  if (summary.thresholdsChecked)
    console.log(
      `thresholds: lines ${summary.thresholds.lines}%, branches ${summary.thresholds.branches}%, functions ${summary.thresholds.functions}%`,
    );
  else console.log("thresholds: not checked for a partial test selection");
  console.log(`coverage report: ${COVERAGE_OUTPUT_DIRECTORY}/lcov.info`);
  console.log(`coverage summary: ${COVERAGE_OUTPUT_DIRECTORY}/summary.json`);
  for (const problem of problems)
    console.error(`coverage check failed: ${problem}`);
  if (problems.length === 0) console.log("coverage check passed");
}

async function readOptionalReport(file) {
  try {
    return await readReport(file);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function skippedTests(events) {
  let skipped = 0;
  for (const entry of events?.summaries ?? []) {
    const counts = entry.counts ?? entry;
    skipped += integer(counts.skipped) + integer(counts.todo);
  }
  return skipped;
}

function integer(value) {
  return Number.isInteger(value) ? value : 0;
}

function appendNodeOption(current, next) {
  return current ? `${current} ${next}` : next;
}
