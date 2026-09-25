export function validateCompletedReport(report, options = {}) {
  if (report?.schemaVersion !== 1) throw new Error("invalid report schema");
  if (!["unit", "browser"].includes(report.suite))
    throw new Error("invalid report suite");
  for (const field of ["commit", "runtime", "nodeVersion"])
    if (typeof report[field] !== "string" || report[field].length === 0)
      throw new Error(`report is missing ${field}`);
  validateRuntime(report.runtime, report.nodeVersion);
  validateShard(report.shard);
  validateUniqueStrings(report.fullFiles, "complete file inventory", false);
  validateUniqueStrings(report.assignedFiles, "assigned file inventory", false);
  const observedFiles = report.observedFiles?.map((entry) => entry.file);
  validateUniqueStrings(observedFiles, "observed file inventory", false);
  requireSameValues(
    report.assignedFiles,
    observedFiles,
    "assigned and observed files",
  );
  requireSubset(report.assignedFiles, report.fullFiles, "assigned files");
  if (!report.shard)
    requireSameValues(
      report.fullFiles,
      report.assignedFiles,
      "unsharded files",
    );
  for (const entry of report.observedFiles) {
    if (!Number.isFinite(entry.durationMs) || entry.durationMs < 0)
      throw new Error(`invalid timing for ${entry.file}`);
    if (!Number.isInteger(entry.tests) || entry.tests < 1)
      throw new Error(`invalid test count for ${entry.file}`);
  }
  if (!Number.isInteger(report.skipped) || report.skipped < 0)
    throw new Error("report has an invalid skipped count");
  if (
    report.skipped !== 0 &&
    !(report.suite === "unit" && options.allowUnitSkips === true)
  )
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
  if (report.suite === "unit") validateUnitFailures(report);
  if (report.suite === "browser") validateBrowserTests(report);
}

export function validateShardReports(reports, expected) {
  if (reports.length !== expected.total)
    throw new Error(`missing shard reports: expected ${expected.total}`);
  const ordered = [...reports].sort(
    (left, right) => left.shard?.index - right.shard?.index,
  );
  const first = ordered[0];
  if (!first) throw new Error("missing shard reports");
  for (const [offset, report] of ordered.entries()) {
    validateCompletedReport(report);
    if (report.suite !== expected.suite)
      throw new Error(`wrong suite ${report.suite}`);
    if (report.commit !== expected.commit)
      throw new Error(`wrong commit ${report.commit}`);
    if (report.runtime !== expected.runtime)
      throw new Error(`wrong runtime ${report.runtime}`);
    if (
      report.shard?.index !== offset + 1 ||
      report.shard.total !== expected.total
    )
      throw new Error("missing, duplicate, or invalid shard identity");
    requireSameValues(
      first.fullFiles,
      report.fullFiles,
      "complete file inventories",
    );
    if (report.nodeVersion !== first.nodeVersion)
      throw new Error("shards used different Node versions");
  }
  requireDisjointComplete(
    ordered.map((report) => report.assignedFiles),
    first.fullFiles,
    "file assignments",
  );
  requireDisjointComplete(
    ordered.map((report) => report.observedFiles.map((entry) => entry.file)),
    first.fullFiles,
    "observed files",
  );
  if (expected.suite === "browser") {
    for (const report of ordered)
      requireSameTestIds(
        first.fullTests,
        report.fullTests,
        "complete test inventories",
      );
    requireDisjointComplete(
      ordered.map((report) => report.assignedTests.map((entry) => entry.id)),
      first.fullTests.map((entry) => entry.id),
      "browser test assignments",
    );
    requireDisjointComplete(
      ordered.map((report) => report.observedTests.map((entry) => entry.id)),
      first.fullTests.map((entry) => entry.id),
      "observed browser tests",
    );
  }
}

function validateUnitFailures(report) {
  if (!Array.isArray(report.failures) || report.failures.length > 0)
    throw new Error("unit report contains test failures");
}

function validateBrowserTests(report) {
  validateTestEntries(
    report.fullTests,
    "complete browser test inventory",
    false,
  );
  validateTestEntries(
    report.assignedTests,
    "assigned browser test inventory",
    false,
  );
  validateTestEntries(
    report.observedTests,
    "observed browser test inventory",
    false,
  );
  requireSameTestIds(
    report.assignedTests,
    report.observedTests,
    "assigned and observed tests",
  );
  requireSubset(
    report.assignedTests.map((entry) => entry.id),
    report.fullTests.map((entry) => entry.id),
    "assigned browser tests",
  );
  if (!report.shard)
    requireSameTestIds(
      report.fullTests,
      report.assignedTests,
      "unsharded browser tests",
    );
  for (const test of report.observedTests) {
    if (test.status !== "passed")
      throw new Error(`browser test ${test.id} has status ${test.status}`);
    if (!Number.isFinite(test.durationMs) || test.durationMs < 0)
      throw new Error(`invalid browser timing for ${test.id}`);
    if (!Array.isArray(test.errors) || test.errors.length > 0)
      throw new Error(`browser test ${test.id} contains errors`);
  }
}

function validateTestEntries(entries, label, allowEmpty) {
  if (!Array.isArray(entries) || (!allowEmpty && entries.length === 0))
    throw new Error(`${label} is empty or missing`);
  validateUniqueStrings(
    entries.map((entry) => entry.id),
    label,
    allowEmpty,
  );
  for (const entry of entries)
    for (const field of ["project", "file", "title"])
      if (typeof entry[field] !== "string" || entry[field].length === 0)
        throw new Error(`${label} has an invalid ${field}`);
}

function validateUniqueStrings(values, label, allowEmpty) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0))
    throw new Error(`${label} is empty or missing`);
  if (values.some((value) => typeof value !== "string" || value.length === 0))
    throw new Error(`${label} has an invalid value`);
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contains duplicate values`);
}

function validateShard(shard) {
  if (shard === null) return;
  if (
    !Number.isSafeInteger(shard?.index) ||
    !Number.isSafeInteger(shard?.total) ||
    shard.index < 1 ||
    shard.total < 1 ||
    shard.index > shard.total
  )
    throw new Error("invalid report shard");
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

function requireSameTestIds(left, right, label) {
  requireSameValues(
    left.map((entry) => entry.id),
    right.map((entry) => entry.id),
    label,
  );
}

function requireSubset(values, complete, label) {
  const inventory = new Set(complete);
  if (values.some((value) => !inventory.has(value)))
    throw new Error(`${label} contain an unexpected value`);
}

function requireDisjointComplete(groups, complete, label) {
  for (const group of groups)
    if (group.length === 0) throw new Error(`${label} contain an empty shard`);
  const union = groups.flat();
  if (new Set(union).size !== union.length)
    throw new Error(`${label} contain duplicate values`);
  requireSameValues(union, complete, `${label} union`);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
