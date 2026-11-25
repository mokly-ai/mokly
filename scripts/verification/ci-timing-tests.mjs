/**
 * List the slowest tests and test files of the verification reports. A
 * report that times each test, such as a browser report, adds test rows.
 * Another report, such as the viewer report, adds a row for each file.
 * Durations stay report text and never fail a test.
 */
export function slowestTests(reports, limit) {
  const tests = [];
  const files = [];
  for (const report of reports) {
    if (!isRecord(report)) continue;
    const source = reportLabel(report);
    if (Array.isArray(report.observedTests)) {
      for (const test of list(report.observedTests))
        if (typeof test.title === "string" && duration(test.durationMs))
          tests.push({ name: test.title, source, ms: test.durationMs });
      continue;
    }
    for (const file of list(report.observedFiles))
      if (typeof file.file === "string" && duration(file.durationMs))
        files.push({
          name: file.file,
          source,
          ms: file.durationMs,
          tests: Number.isInteger(file.tests) ? file.tests : null,
        });
  }
  return { tests: top(tests, limit), files: top(files, limit) };
}

function reportLabel(report) {
  const suite = typeof report.suite === "string" ? report.suite : "unknown";
  const shard = isRecord(report.shard)
    ? ` ${report.shard.index}/${report.shard.total}`
    : "";
  const runtime =
    typeof report.runtime === "string" ? `, ${report.runtime}` : "";
  return `${suite}${shard}${runtime}`;
}

function top(rows, limit) {
  return rows
    .sort(
      (left, right) =>
        right.ms - left.ms || left.name.localeCompare(right.name),
    )
    .slice(0, limit);
}

function list(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function duration(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
