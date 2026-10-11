import fs from "node:fs/promises";
import path from "node:path";

import { unitTestConcurrency } from "./concurrency.mjs";
import {
  defaultReportPath,
  discoverUnitFiles,
  nodeShardFiles,
  parseShardArgument,
  verificationIdentity,
  writeReport,
} from "./evidence.mjs";
import { requirePrepared } from "./prepared.mjs";
import { validateCompletedReport } from "./report-validation.mjs";
import { executeUnitTests } from "./unit-execution.mjs";
import { runSelectedUnitVerification } from "./unit-selected-run.mjs";
import { parseUnitSelection } from "./unit-selection.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/** Run the same discovered Node suite with strict gate or developer skip policy. */
export async function runUnitVerification(policy, argv) {
  if (policy !== "strict" && policy !== "developer")
    throw new Error("unknown unit verification policy " + policy);
  if (policy === "developer") {
    const selection = await parseUnitSelection(repositoryRoot, argv);
    if (selection.selected)
      return await runSelectedUnitVerification(repositoryRoot, selection);
  }
  const shard = policy === "strict" ? parseShardArgument(argv) : undefined;
  const concurrency = unitTestConcurrency();
  const identity = await verificationIdentity(repositoryRoot);
  const reportPath =
    process.env.MOKLY_VERIFICATION_REPORT ??
    defaultReportPath(repositoryRoot, "unit", shard);
  const eventPath = reportPath + ".events";
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
  await requirePrepared(repositoryRoot, "unit");
  console.log(`unit test files active at once: ${concurrency}`);
  const result = await executeUnitTests(repositoryRoot, {
    files: fullFiles,
    concurrency,
    shard,
    eventPath,
  });
  const report = {
    schemaVersion: 1,
    suite: "unit",
    ...identity,
    shard: shard ?? null,
    fullFiles,
    assignedFiles,
    observedFiles: result.observedFiles,
    fullTests: [],
    assignedTests: [],
    observedTests: [],
    failures: result.failures,
    skipped: result.skipped,
    cancelled: result.cancelled,
    reporterComplete: result.reporterComplete,
    reporterErrors: [],
    durationMs: result.durationMs,
    outcome: result.outcome,
  };
  let evidenceError = result.evidenceError;
  try {
    validateCompletedReport(
      report,
      policy === "developer" ? { allowUnitSkips: true } : undefined,
    );
  } catch (error) {
    evidenceError ??= error;
    report.outcome.status = "failed";
  }
  await writeReport(reportPath, report);
  await fs.rm(eventPath, { force: true });
  if (policy === "developer")
    console.log("unit tests skipped or todo: " + result.skipped);
  if (evidenceError) throw evidenceError;
}
