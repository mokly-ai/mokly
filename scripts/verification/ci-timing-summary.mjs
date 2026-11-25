const BUDGET_FILE = "scripts/verification/ci-budgets.json";
// GitHub shows at most 10 annotations of each level for one step.
const ANNOTATION_LIMIT = 10;

/** Format whole seconds as `28m 05s`, or `42s` below one minute. */
function formatSeconds(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const rest = String(seconds % 60).padStart(2, "0");
  return `${Math.floor(seconds / 60)}m ${rest}s`;
}

/**
 * The workflow command lines for each budget overrun, missing budget, and
 * issue. When a level has more findings than GitHub shows, its last line
 * counts the rest and points to the job summary.
 */
export function annotationLines(report) {
  const level = report.mode === "fail" ? "error" : "warning";
  const found = { error: [], warning: [] };
  const add = (command, text) => found[command].push(text);
  if (report.wallOverSeconds !== null)
    add(
      level,
      `The run took ${formatSeconds(report.path.wallSeconds)}, above its ${report.wallClockMinutes}m wall-clock budget.`,
    );
  for (const row of report.rows)
    if (row.state === "no-budget")
      add(
        "warning",
        `${row.job.name} has no budget. Add a matching pattern to ${BUDGET_FILE}.`,
      );
  for (const row of report.rows)
    if (row.state === "over")
      add(
        level,
        `${row.job.name} ran ${formatSeconds(row.seconds)}, above its ${row.budget.minutes}m budget (pattern "${row.budget.pattern}").`,
      );
  for (const issue of report.issues) add("warning", issue);
  return Object.entries(found).flatMap(([command, texts]) => {
    const shown =
      texts.length > ANNOTATION_LIMIT
        ? [
            ...texts.slice(0, ANNOTATION_LIMIT - 1),
            `${texts.length - ANNOTATION_LIMIT + 1} more findings are in the job summary.`,
          ]
        : texts;
    return shown.map(
      (text) => `::${command} title=CI duration budget::${escapeCommand(text)}`,
    );
  });
}

/** The Markdown job summary of one report. */
export function renderSummary(report) {
  const lines = ["## CI timing", "", modeLine(report.mode), ""];
  lines.push(...wallClockLines(report), "");
  if (report.path) lines.push(...pathLines(report.path), "");
  lines.push(...jobLines(report.rows), "");
  lines.push(...testLines(report.slowest), "");
  if (report.issues.length > 0)
    lines.push(
      "### Notes",
      "",
      ...report.issues.map((issue) => `- ${cell(issue)}`),
      "",
    );
  return `${lines.join("\n").trimEnd()}\n`;
}

function modeLine(mode) {
  return mode === "fail"
    ? "Budgets fail this check: a job or the wall clock above its budget fails the step."
    : "Budgets are warnings: a job above its budget adds a warning and fails nothing.";
}

function wallClockLines({ path, wallClockMinutes, wallOverSeconds, attempt }) {
  if (!path) return ["No job of this attempt has completed."];
  const wall = `Wall clock of attempt ${attempt}: ${formatSeconds(path.wallSeconds)}`;
  if (path.reusedJobs > 0)
    return [
      `${wall}. This attempt reran ${path.ranJobs} jobs and reused ${path.reusedJobs} jobs from an earlier attempt.`,
      "The wall clock and the critical path cover the rerun jobs only. The wall-clock budget applies only to an attempt that reused no job.",
    ];
  const over =
    wallOverSeconds === null
      ? "within budget"
      : `⚠️ over by ${formatSeconds(wallOverSeconds)}`;
  return [`${wall}, budget ${wallClockMinutes}m, ${over}.`];
}

function pathLines(path) {
  return [
    "### Critical path",
    "",
    "| Job | Wait | Run | Ends at |",
    "| --- | ---: | ---: | ---: |",
    ...path.segments.map(
      (segment) =>
        `| ${jobCell(segment.job)} | ${formatSeconds(segment.waitSeconds)} | ${formatSeconds(segment.runSeconds)} | ${formatSeconds(segment.endSeconds)} |`,
    ),
    "",
    "Wait is the time from the end of the previous job on the path, or from the start of the attempt, to the start of the job.",
  ];
}

function jobLines(rows) {
  return [
    "### Job durations",
    "",
    "| Job | Result | Run | Budget | Status | Slowest step |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...rows
      .map((row) =>
        [
          jobCell(row.job),
          result(row.job),
          row.seconds === null ? "–" : formatSeconds(row.seconds),
          row.budget
            ? `${row.budget.minutes}m (\`${cell(row.budget.pattern)}\`)`
            : "none",
          status(row),
          row.slowestStep
            ? `${cell(row.slowestStep.name)}, ${formatSeconds(row.slowestStep.seconds)}`
            : "–",
        ].join(" | "),
      )
      .map((line) => `| ${line} |`),
  ];
}

function testLines({ tests, files }) {
  const lines = ["### Slowest tests", ""];
  if (tests.length === 0 && files.length === 0)
    return [...lines, "No verification report with test durations was found."];
  if (tests.length > 0)
    lines.push(
      "| Test | Report | Duration |",
      "| --- | --- | ---: |",
      ...tests.map(
        (row) =>
          `| ${cell(row.name)} | ${cell(row.source)} | ${milliseconds(row.ms)} |`,
      ),
      "",
    );
  if (files.length > 0)
    lines.push(
      "| Test file | Report | Tests | Duration |",
      "| --- | --- | ---: | ---: |",
      ...files.map(
        (row) =>
          `| ${cell(row.name)} | ${cell(row.source)} | ${row.tests ?? "–"} | ${milliseconds(row.ms)} |`,
      ),
    );
  return lines;
}

function status(row) {
  if (row.state === "over")
    return `⚠️ over by ${formatSeconds(row.seconds - row.budget.minutes * 60)}`;
  if (row.state === "no-budget") return "⚠️ no budget";
  if (row.state === "within") return "within";
  return "not run";
}

function result(job) {
  const value = job.conclusion ?? job.status;
  return job.reused ? `${value}, earlier attempt` : value;
}

function jobCell(job) {
  return job.url ? `[${cell(job.name)}](${job.url})` : cell(job.name);
}

function milliseconds(ms) {
  return ms < 60_000
    ? `${(ms / 1000).toFixed(1)}s`
    : formatSeconds(Math.round(ms / 1000));
}

function cell(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[[\]|]/g, "\\$&")
    .replace(/\s*[\r\n]+\s*/g, " ");
}

function escapeCommand(text) {
  return text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
