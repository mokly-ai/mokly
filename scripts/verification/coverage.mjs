import path from "node:path";

/** Source roots whose TypeScript files the coverage summary reports. */
export const COVERAGE_SOURCE_ROOTS = ["src", "packages/viewer/src"];

/** Generated output whose source maps lead back to the source roots. */
export const COVERAGE_GENERATED_ROOTS = ["dist", "packages/viewer/dist"];

/** Reported metrics in presentation order. */
const COVERAGE_METRICS = ["lines", "branches", "functions"];

const METRIC_SUFFIXES = {
  lines: "Line",
  branches: "Branch",
  functions: "Function",
};

/** Node include globs; generated output must be included so Node maps it. */
export function coverageIncludeGlobs() {
  return [...COVERAGE_SOURCE_ROOTS, ...COVERAGE_GENERATED_ROOTS].map(
    (root) => `${root}/**`,
  );
}

/** Validate the reviewed minimum percentages for the complete suite. */
export function parseThresholds(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("coverage thresholds must be a JSON object");
  const unknown = Object.keys(value).filter(
    (key) => !COVERAGE_METRICS.includes(key),
  );
  if (unknown.length > 0)
    throw new Error(`unknown coverage threshold keys: ${unknown.join(", ")}`);
  const thresholds = {};
  for (const metric of COVERAGE_METRICS) {
    const percent = value[metric];
    if (
      typeof percent !== "number" ||
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > 100
    )
      throw new Error(
        `coverage threshold ${metric} must be a number from 0 to 100`,
      );
    thresholds[metric] = percent;
  }
  return thresholds;
}

/** Select the test files to run; an empty selection means the complete suite. */
export function selectCoverageFiles(fullFiles, argv) {
  const usage = "usage: run-coverage.mjs [TEST_FILE...]";
  if (argv.length === 0) return { complete: true, files: [...fullFiles] };
  const files = [];
  for (const argument of argv) {
    if (argument.startsWith("-")) throw new Error(usage);
    const file = argument.split(path.sep).join("/").replace(/^\.\//u, "");
    if (!fullFiles.includes(file))
      throw new Error(`${file} is not a discovered unit test file; ${usage}`);
    if (!files.includes(file)) files.push(file);
  }
  return { complete: false, files };
}

/** Convert Node's summary into repository-relative source files and totals. */
export function summarizeCoverage(summary, repositoryRoot) {
  const files = [];
  const unmapped = [];
  for (const entry of summary.files) {
    const record = fileRecord(entry, repositoryRoot);
    if (isUnder(record.file, COVERAGE_SOURCE_ROOTS)) files.push(record);
    else unmapped.push(record);
  }
  files.sort(byFile);
  unmapped.sort(byFile);
  return { files, totals: totals(files), unmapped };
}

/** Name every metric whose complete-suite percentage is below its threshold. */
export function evaluateThresholds(totals, thresholds) {
  const findings = [];
  for (const metric of COVERAGE_METRICS) {
    const percent = totals[metric].percent;
    if (percent < thresholds[metric])
      findings.push(
        `${metric} coverage ${formatPercent(percent)}% is below the ${formatPercent(thresholds[metric])}% threshold`,
      );
  }
  return findings;
}

/** Render the totals, the least-covered files, and unmapped generated output. */
export function formatCoverageSummary(summary, options = {}) {
  const lowest = options.lowest ?? 10;
  const lines = [
    `coverage ${COVERAGE_METRICS.map((metric) => formatMetric(metric, summary.totals[metric])).join(", ")}`,
  ];
  const shown = [...summary.files]
    .sort(
      (left, right) =>
        left.lines.percent - right.lines.percent || byFile(left, right),
    )
    .slice(0, lowest);
  if (shown.length > 0)
    lines.push(`lowest line coverage (${shown.length} files):`);
  for (const record of shown)
    lines.push(
      `  ${formatPercent(record.lines.percent).padStart(6)}% ${record.file} (${record.lines.covered}/${record.lines.total})`,
    );
  if (summary.unmapped.length > 0) {
    lines.push(
      `generated files without source mapping, excluded from totals (${summary.unmapped.length}):`,
    );
    for (const record of summary.unmapped) lines.push(`  ${record.file}`);
  }
  return lines;
}

function formatPercent(percent) {
  return percent.toFixed(2);
}

function formatMetric(metric, counts) {
  return `${metric} ${formatPercent(counts.percent)}% (${counts.covered}/${counts.total})`;
}

function fileRecord(entry, repositoryRoot) {
  const relative = path.relative(repositoryRoot, entry.path);
  const file =
    relative.startsWith("..") || path.isAbsolute(relative)
      ? entry.path.split(path.sep).join("/")
      : relative.split(path.sep).join("/");
  const record = { file };
  for (const metric of COVERAGE_METRICS) record[metric] = counts(entry, metric);
  return record;
}

function counts(entry, metric) {
  const suffix = METRIC_SUFFIXES[metric];
  return withPercent(
    integer(entry[`covered${suffix}Count`]),
    integer(entry[`total${suffix}Count`]),
  );
}

function totals(files) {
  const result = {};
  for (const metric of COVERAGE_METRICS) {
    let covered = 0;
    let total = 0;
    for (const record of files) {
      covered += record[metric].covered;
      total += record[metric].total;
    }
    result[metric] = withPercent(covered, total);
  }
  return result;
}

function withPercent(covered, total) {
  return {
    covered,
    total,
    percent: total === 0 ? 100 : (covered / total) * 100,
  };
}

function integer(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function isUnder(file, roots) {
  return roots.some((root) => file.startsWith(`${root}/`));
}

function byFile(left, right) {
  return left.file < right.file ? -1 : left.file > right.file ? 1 : 0;
}
