export function validateCompletedReport(report, options = {}) {
  if (report?.schemaVersion !== 1) throw new Error("invalid report schema");
  if (report.suite !== "viewer") throw new Error("invalid report suite");
  for (const field of ["commit", "runtime", "nodeVersion"])
    if (typeof report[field] !== "string" || report[field].length === 0)
      throw new Error(`report is missing ${field}`);
  validateRuntime(report.runtime, report.nodeVersion);
  if (report.shard !== null) throw new Error("viewer report must be unsharded");
  validateUniqueStrings(report.fullFiles, "complete file inventory", false);
  validateUniqueStrings(report.assignedFiles, "assigned file inventory", false);
  const observedFiles = report.observedFiles?.map((entry) => entry.file);
  validateUniqueStrings(observedFiles, "observed file inventory", false);
  requireSameValues(
    report.assignedFiles,
    observedFiles,
    "assigned and observed files",
  );
  requireSameValues(report.fullFiles, report.assignedFiles, "unsharded files");
  for (const entry of report.observedFiles) {
    if (!Number.isFinite(entry.durationMs) || entry.durationMs < 0)
      throw new Error(`invalid timing for ${entry.file}`);
    if (!Number.isInteger(entry.tests) || entry.tests < 1)
      throw new Error(`invalid test count for ${entry.file}`);
  }
  if (!Number.isInteger(report.skipped) || report.skipped < 0)
    throw new Error("report has an invalid skipped count");
  if (report.skipped !== 0 && options.allowUnitSkips !== true)
    throw new Error("report contains skipped tests");
  if (report.cancelled !== 0)
    throw new Error("report contains cancelled tests");
  if (report.reporterComplete !== true)
    throw new Error("reporter did not complete");
  if (!Array.isArray(report.reporterErrors) || report.reporterErrors.length > 0)
    throw new Error("report contains reporter errors");
  if (
    report.outcome?.status !== "passed" ||
    report.outcome.exitCode !== 0 ||
    report.outcome.signal !== null
  )
    throw new Error("report process outcome is not a successful zero exit");
  if (!Array.isArray(report.failures) || report.failures.length > 0)
    throw new Error("viewer report contains test failures");
}

export function validateUnshardedReport(report, expected) {
  validateCompletedReport(report);
  if (report.suite !== expected.suite)
    throw new Error(`wrong suite ${report.suite}`);
  if (report.commit !== expected.commit)
    throw new Error(`wrong commit ${report.commit}`);
  if (report.runtime !== expected.runtime)
    throw new Error(`wrong runtime ${report.runtime}`);
  if (report.shard !== null) throw new Error("report must be unsharded");
}

function validateUniqueStrings(values, label, allowEmpty) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0))
    throw new Error(`${label} is empty or missing`);
  if (values.some((value) => typeof value !== "string" || value.length === 0))
    throw new Error(`${label} has an invalid value`);
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contains duplicate values`);
}

function validateRuntime(runtime, nodeVersion) {
  const match = /^node-(\d+)(?:\.(\d+)\.(\d+))?$/.exec(runtime);
  const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(nodeVersion);
  if (!match || !version || match[1] !== version[1])
    throw new Error(`runtime ${runtime} does not match Node ${nodeVersion}`);
  if (
    match[2] !== undefined &&
    (match[2] !== version[2] || match[3] !== version[3])
  )
    throw new Error(`runtime ${runtime} does not match Node ${nodeVersion}`);
}

function requireSameValues(left, right, label) {
  if (sorted(left).join("\n") !== sorted(right).join("\n"))
    throw new Error(`${label} do not match`);
}

function sorted(values) {
  return [...values].sort();
}
