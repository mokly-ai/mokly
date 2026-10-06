import fs from "node:fs";
import path from "node:path";

/**
 * Node test reporter that retains the final coverage summary.
 *
 * The runner pairs this reporter with the evidence reporter, so it prints one
 * confirmation line at most. It writes the `test:coverage` summary as JSON to
 * `MOKLY_COVERAGE_REPORT` and, when `MOKLY_COVERAGE_LCOV` is set, an lcov
 * tracefile with the same content as Node's own lcov reporter. Writing happens
 * in a `finally` block so a missing or incomplete summary stays visible.
 */
export default async function* coverageReporter(source) {
  const output = process.env.MOKLY_COVERAGE_REPORT;
  if (!output) throw new Error("MOKLY_COVERAGE_REPORT is required");
  const lcov = process.env.MOKLY_COVERAGE_LCOV;
  let summary = null;
  let reporterComplete = false;
  try {
    for await (const event of source) {
      if (event.type === "test:coverage") summary = event.data.summary;
    }
    reporterComplete = true;
  } finally {
    fs.writeFileSync(
      output,
      `${JSON.stringify({ reporterComplete, summary }, null, 2)}\n`,
    );
    if (lcov && summary) fs.writeFileSync(lcov, lcovTracefile(summary));
  }
  if (summary) yield `coverage retained for ${summary.files.length} file(s)\n`;
}

/** Render Node's coverage summary in the lcov tracefile format. */
export function lcovTracefile(summary) {
  let tracefile = "TN:\n";
  for (const file of summary.files) {
    tracefile += `SF:${path.relative(summary.workingDirectory, file.path)}\n`;
    let executions = "";
    file.functions.forEach((entry, index) => {
      const name = entry.name || `anonymous_${index}`;
      tracefile += `FN:${entry.line},${name}\n`;
      executions += `FNDA:${entry.count},${name}\n`;
    });
    tracefile += executions;
    tracefile += `FNF:${file.totalFunctionCount}\n`;
    tracefile += `FNH:${file.coveredFunctionCount}\n`;
    file.branches.forEach((branch, index) => {
      tracefile += `BRDA:${branch.line},${index},0,${branch.count}\n`;
    });
    tracefile += `BRF:${file.totalBranchCount}\n`;
    tracefile += `BRH:${file.coveredBranchCount}\n`;
    const lines = [...file.lines].sort((left, right) => left.line - right.line);
    for (const line of lines) tracefile += `DA:${line.line},${line.count}\n`;
    tracefile += `LH:${file.coveredLineCount}\n`;
    tracefile += `LF:${file.totalLineCount}\n`;
    tracefile += "end_of_record\n";
  }
  return tracefile;
}
