import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { unitTestConcurrency } from "./concurrency.mjs";
import { discoverUnitFiles } from "./evidence.mjs";
import { ExpectedFailure } from "./expected-failure.mjs";
import { requirePrepared } from "./prepared.mjs";
import { executeUnitTests } from "./unit-execution.mjs";
import { selectedFailureGroups } from "./unit-failure-groups.mjs";
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
      selected: true,
      patterns: selection.patterns,
      eventPath: path.join(temporary, "report.events"),
    });
    console.log("unit tests skipped or todo: " + result.skipped);
    const observed = new Map(
      result.observedFiles.map(({ file, tests }) => [file, tests]),
    );
    for (const { file } of selection.files)
      if (observed.get(file) === 0)
        console.log(
          "warning: no test ran in " +
            file +
            (selection.patterns.length > 0
              ? "; check --test-name-pattern"
              : ""),
        );
    if (
      selection.files.length === 0 &&
      [...observed.values()].every((tests) => tests === 0)
    )
      console.log("warning: no test matched --test-name-pattern");
    console.log(
      "selected files: " +
        files.length +
        "; tests run: " +
        result.testsRun +
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
  const failures = selectedFailureGroups(result);
  if (failures) throw new ExpectedFailure(failures);
  if (
    result.outcome.status !== "passed" ||
    result.outcome.exitCode !== 0 ||
    result.outcome.signal !== null
  )
    throw new ExpectedFailure(
      "selected unit test process exited with " +
        (result.outcome.signal !== null
          ? "signal " + result.outcome.signal
          : "code " + result.outcome.exitCode),
    );
  const observed = new Set(result.observedFiles.map(({ file }) => file));
  const selected = new Set(files);
  const missing = files.filter((file) => !observed.has(file));
  const unexpected = [...observed].filter((file) => !selected.has(file));
  if (
    result.observedFiles.length !== files.length ||
    observed.size !== files.length ||
    files.some((file) => !observed.has(file))
  )
    throw new Error(
      "selected and observed unit files differ; missing: " +
        (missing.join(", ") || "none") +
        "; unexpected: " +
        (unexpected.join(", ") || "none"),
    );
}
