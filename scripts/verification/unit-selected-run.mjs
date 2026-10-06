import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { unitTestConcurrency } from "./concurrency.mjs";
import { discoverUnitFiles } from "./evidence.mjs";
import { requirePrepared } from "./prepared.mjs";
import { executeUnitTests } from "./unit-execution.mjs";
import { selectUnitFiles } from "./unit-selection.mjs";

/** Run partial verification without accessing persistent evidence paths. */
export async function runSelectedUnitVerification(repositoryRoot, selection) {
  const concurrency = unitTestConcurrency();
  const inventory = await discoverUnitFiles(repositoryRoot);
  const files = selectUnitFiles(selection, inventory);
  await requirePrepared(repositoryRoot);
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-unit-selected-"),
  );
  try {
    console.log(`unit test files active at once: ${concurrency}`);
    const result = await executeUnitTests(repositoryRoot, {
      files,
      concurrency,
      patterns: selection.patterns,
      eventPath: path.join(temporary, "report.events"),
    });
    console.log("unit tests skipped or todo: " + result.skipped);
    console.log(
      "selected files: " +
        files.length +
        "; partial verification; complete gate: cargo xtask check",
    );
    validateSelectedRun(result, files);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

function validateSelectedRun(result, files) {
  if (result.evidenceError) throw result.evidenceError;
  if (result.reporterComplete !== true)
    throw new Error("Node reporter did not complete");
  if (
    result.outcome.status !== "passed" ||
    result.outcome.exitCode !== 0 ||
    result.outcome.signal !== null
  )
    throw new Error("selected unit test process did not finish successfully");
  if (result.failed !== 0 || result.failures.length > 0)
    throw new Error("selected unit tests failed");
  if (result.cancelled !== 0)
    throw new Error("selected unit tests were cancelled");
  const observed = new Set(result.observedFiles.map(({ file }) => file));
  if (
    result.observedFiles.length !== files.length ||
    observed.size !== files.length ||
    files.some((file) => !observed.has(file))
  )
    throw new Error("selected and observed unit files differ");
}
