import fs from "node:fs/promises";
import path from "node:path";

import { readReports } from "./aggregate.mjs";

const usage = "usage: shard-weights.mjs --reports <directory>";

/**
 * Compute shard weights from passed CI reports. A browser weight is the
 * median, over reports, of a spec's summed per-test wall time divided by its
 * test count. A viewer weight is the median measured duration of a file.
 */
export function shardWeights(reports) {
  const browser = new Map();
  const viewer = new Map();
  for (const report of reports) {
    if (report?.outcome?.status !== "passed") continue;
    if (report.suite === "browser")
      for (const [file, cost] of browserCosts(report))
        sample(browser, file, cost);
    if (report.suite === "viewer")
      for (const entry of report.observedFiles)
        sample(viewer, entry.file, entry.durationMs);
  }
  if (browser.size === 0 || viewer.size === 0)
    throw new Error("shard weights need passed viewer and browser reports");
  return {
    browser: medians(browser, (value) => Math.round(value * 1000) / 1000),
    viewer: medians(viewer, Math.round),
  };
}

function browserCosts(report) {
  const files = new Map();
  for (const test of report.observedTests) {
    if (!Number.isFinite(test.wallMs) || test.wallMs < 0)
      throw new Error(`browser test ${test.id} has no wall time`);
    const entry = files.get(test.specFile) ?? { wallMs: 0, tests: 0 };
    entry.wallMs += test.wallMs;
    entry.tests += 1;
    files.set(test.specFile, entry);
  }
  return [...files].map(([file, entry]) => [file, entry.wallMs / entry.tests]);
}

function sample(samples, file, value) {
  const values = samples.get(file) ?? [];
  values.push(value);
  samples.set(file, values);
}

function medians(samples, round) {
  const result = {};
  for (const file of [...samples.keys()].sort()) {
    const values = samples.get(file).sort((left, right) => left - right);
    const middle = Math.floor(values.length / 2);
    result[file] = round(
      values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2,
    );
  }
  return result;
}

/**
 * Write both weight files from the reports under one directory, and resolve
 * to the number of browser specs and viewer files that they hold.
 */
export async function writeShardWeights(directory) {
  const weights = shardWeights(await readReports(directory));
  for (const suite of ["browser", "viewer"])
    await fs.writeFile(
      path.join(import.meta.dirname, `${suite}-shard-weights.json`),
      `${JSON.stringify(weights[suite], null, 2)}\n`,
    );
  return {
    browser: Object.keys(weights.browser).length,
    viewer: Object.keys(weights.viewer).length,
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--reports") throw new Error(usage);
  const counts = await writeShardWeights(args[1]);
  process.stdout.write(
    `Wrote weights for ${counts.browser} browser specs and ${counts.viewer} viewer files.\n`,
  );
}
