import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  defaultReportPath,
  discoverUnitFiles,
  nodeShardFiles,
  parseShardArgument,
  readReport,
  verificationIdentity,
  writeReport,
} from "./evidence.mjs";
import { requirePrepared } from "./prepared.mjs";
import { runInherited } from "./process.mjs";
import { validateCompletedReport } from "./report-validation.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const shard = parseShardArgument(process.argv.slice(2));
const identity = await verificationIdentity(repositoryRoot);
const reportPath =
  process.env.MOKLY_VERIFICATION_REPORT ??
  defaultReportPath(repositoryRoot, "unit", shard);
const eventPath = `${reportPath}.events`;
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await Promise.all([
  fs.rm(reportPath, { force: true }),
  fs.rm(eventPath, { force: true }),
]);
const fullFiles = await discoverUnitFiles(repositoryRoot);
if (fullFiles.length === 0) throw new Error("unit test discovery was empty");
const assignedFiles = nodeShardFiles(fullFiles, shard);
if (assignedFiles.length === 0)
  throw new Error("unit shard assignment was empty");
await requirePrepared(repositoryRoot);
const started = performance.now();
const args = [
  "--import",
  "tsx",
  "--test",
  "--test-concurrency=2",
  "--test-reporter=./scripts/verification/node-reporter.mjs",
];
if (shard) args.push(`--test-shard=${shard.index}/${shard.total}`);
args.push(...fullFiles);
const outcome = await runInherited(process.execPath, args, {
  cwd: repositoryRoot,
  env: { ...process.env, MOKLY_NODE_EVENT_REPORT: eventPath },
});

let raw;
let evidenceError;
try {
  raw = await readReport(eventPath);
  if (raw.reporterComplete !== true)
    throw new Error("Node reporter did not complete");
} catch (error) {
  evidenceError = error;
  raw = { summaries: [] };
}
const observedFiles = raw.summaries.map((summary) => fileEvidence(summary));
const skipped = raw.summaries.reduce(
  (total, summary) =>
    total + count(summary, "skipped") + count(summary, "todo"),
  0,
);
const cancelled = raw.summaries.reduce(
  (total, summary) => total + count(summary, "cancelled"),
  0,
);
const report = {
  schemaVersion: 1,
  suite: "unit",
  ...identity,
  shard: shard ?? null,
  fullFiles,
  assignedFiles,
  observedFiles,
  fullTests: [],
  assignedTests: [],
  observedTests: [],
  failures: raw.failures ?? [],
  skipped,
  cancelled,
  reporterComplete: raw.reporterComplete === true,
  reporterErrors: [],
  durationMs: performance.now() - started,
  outcome: {
    exitCode: outcome.exitCode,
    signal: outcome.signal ?? outcome.interrupted,
    status:
      outcome.exitCode === 0 &&
      outcome.signal === null &&
      outcome.interrupted === null &&
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

function fileEvidence(summary) {
  const absolute = path.resolve(summary.file);
  const relative = path.relative(repositoryRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(
      `Node reported a test outside the repository: ${summary.file}`,
    );
  const tests = count(summary, "tests");
  return {
    file: relative.split(path.sep).join("/"),
    durationMs: Number(summary.duration_ms ?? summary.durationMs ?? 0),
    tests,
  };
}

function count(summary, name) {
  const value = summary.counts?.[name] ?? summary[name] ?? 0;
  return Number.isInteger(value) ? value : 0;
}
