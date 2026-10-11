import path from "node:path";
import { performance } from "node:perf_hooks";

import { readReport } from "./evidence.mjs";
import { runInherited } from "./process.mjs";

/** Execute Node once and collect the same reporter evidence for both policies. */
export async function executeUnitTests(repositoryRoot, options) {
  const started = performance.now();
  const args = [
    "--import",
    "tsx",
    "--test",
    `--test-concurrency=${options.concurrency}`,
    "--test-reporter=./scripts/verification/node-reporter.mjs",
  ];
  if (options.shard)
    args.push(
      "--test-shard=" + options.shard.index + "/" + options.shard.total,
    );
  for (const pattern of options.patterns ?? [])
    args.push("--test-name-pattern=" + pattern);
  args.push(...options.files);
  const outcome = await runInherited(process.execPath, args, {
    cwd: repositoryRoot,
    env: { ...process.env, MOKLY_NODE_EVENT_REPORT: options.eventPath },
  });

  let evidence;
  let evidenceError;
  let reporterUnavailable = false;
  try {
    const raw = await readReport(options.eventPath);
    if (raw.reporterComplete !== true) {
      reporterUnavailable = true;
      throw new Error("Node reporter did not complete");
    }
    if (!Array.isArray(raw.summaries) || !Array.isArray(raw.failures))
      throw new Error("Node reporter output is invalid");
    evidence = {
      observedFiles: raw.summaries.map((summary) =>
        fileEvidence(repositoryRoot, summary),
      ),
      failures: raw.failures.map(({ name, diagnostic }) => ({
        name,
        diagnostic,
      })),
      skipped: sum(raw.summaries, "skipped") + sum(raw.summaries, "todo"),
      cancelled: sum(raw.summaries, "cancelled"),
      failed: sum(raw.summaries, "failed"),
      reporterComplete: true,
    };
    if (options.selected) {
      evidence.failedNames = raw.failures
        .filter(
          ({ failureType }) =>
            ![
              "subtestsFailed",
              "testTimeoutFailure",
              "cancelledByParent",
            ].includes(failureType),
        )
        .map(({ name }) => name);
      evidence.cancelledNames = raw.failures
        .filter(({ failureType }) =>
          ["testTimeoutFailure", "cancelledByParent"].includes(failureType),
        )
        .map(({ name }) => name);
      const summaries = new Set(evidence.observedFiles.map(({ file }) => file));
      for (const fileResult of raw.fileResults ?? []) {
        const file = fileEvidence(repositoryRoot, { ...fileResult, tests: 0 });
        if (fileResult.status === "passed" && !summaries.has(file.file)) {
          evidence.observedFiles.push(file);
          summaries.add(file.file);
        }
      }
      evidence.testsRun =
        sum(raw.summaries, "passed") + evidence.failed + evidence.cancelled;
    }
  } catch (error) {
    reporterUnavailable ||= error.code === "ENOENT";
    evidenceError = error;
    evidence = {
      observedFiles: [],
      failures: [],
      skipped: 0,
      cancelled: 0,
      failed: 0,
      reporterComplete: false,
    };
    if (options.selected) evidence.testsRun = 0;
  }
  return {
    ...evidence,
    evidenceError,
    reporterUnavailable,
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
}

function fileEvidence(repositoryRoot, summary) {
  if (typeof summary.file !== "string")
    throw new Error("Node reporter file is invalid");
  const relative = path.relative(
    repositoryRoot,
    path.resolve(repositoryRoot, summary.file),
  );
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error(
      "Node reported a test outside the repository: " + summary.file,
    );
  const durationMs = Number(summary.duration_ms ?? summary.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 0)
    throw new Error("Node reporter timing is invalid for " + summary.file);
  if (summary.counts?.tests === undefined && summary.tests === undefined)
    throw new Error("Node reporter test count is missing for " + summary.file);
  return {
    file: relative.split(path.sep).join("/"),
    durationMs,
    tests: count(summary, "tests"),
  };
}

function sum(summaries, name) {
  return summaries.reduce((total, summary) => total + count(summary, name), 0);
}

function count(summary, name) {
  let value = summary.counts?.[name];
  if (value === undefined) value = summary[name];
  if (value === undefined) value = 0;
  if (!Number.isInteger(value) || value < 0)
    throw new Error("Node reporter has an invalid " + name + " count");
  return value;
}
