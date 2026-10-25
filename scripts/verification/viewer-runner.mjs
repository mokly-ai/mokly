import fs from "node:fs/promises";
import path from "node:path";

import { unitTestConcurrency } from "./concurrency.mjs";
import {
  defaultReportPath,
  discoverNodeFiles,
  verificationIdentity,
  writeReport,
} from "./evidence.mjs";
import { executeNodeTests } from "./node-execution.mjs";
import { requirePrepared } from "./prepared.mjs";
import { validateCompletedReport } from "./report-validation.mjs";
import { runSelectedViewerVerification } from "./viewer-selected-run.mjs";
import { parseViewerSelection } from "./viewer-selection.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/** Run the same discovered Node suite with strict gate or developer skip policy. */
export async function runViewerVerification(policy, argv) {
  if (policy !== "strict" && policy !== "developer")
    throw new Error("unknown unit verification policy " + policy);
  if (policy === "developer") {
    const selection = await parseViewerSelection(repositoryRoot, argv);
    if (selection.selected)
      return await runSelectedViewerVerification(repositoryRoot, selection);
  }
  if (policy === "strict" && argv.length)
    throw new Error("The viewer suite takes no filters or shards");
  const concurrency = unitTestConcurrency();
  const identity = await verificationIdentity(repositoryRoot);
  const reportPath =
    process.env.MOKLY_VERIFICATION_REPORT ?? defaultReportPath(repositoryRoot);
  const eventPath = reportPath + ".events";
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await Promise.all([
    fs.rm(reportPath, { force: true }),
    fs.rm(eventPath, { force: true }),
  ]);
  const fullFiles = await discoverNodeFiles(repositoryRoot);
  if (fullFiles.length === 0) throw new Error("unit test discovery was empty");
  const assignedFiles = [...fullFiles];
  if (assignedFiles.length === 0)
    throw new Error("unit shard assignment was empty");
  await requirePrepared(repositoryRoot);
  console.log(`unit test files active at once: ${concurrency}`);
  const result = await executeNodeTests(repositoryRoot, {
    files: fullFiles,
    concurrency,
    eventPath,
  });
  const report = {
    schemaVersion: 1,
    suite: "viewer",
    ...identity,
    shard: null,
    fullFiles,
    assignedFiles,
    observedFiles: result.observedFiles,
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
