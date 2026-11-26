import fs from "node:fs/promises";
import path from "node:path";

import ciShards from "./ci-shards.json" with { type: "json" };
import { readReport } from "./evidence.mjs";
import { validateShardReports } from "./report-validation.mjs";

const SUITES = ["viewer", "browser"];
/**
 * The supported runtime profiles of CI, keyed by their runtime list, and the
 * runtimes on which each suite runs in that profile. The ordinary profile
 * runs both suites on Node 22.15.0. The Release Please profile also runs the
 * viewer suite on Node 24; the browser suite stays on Node 22.15.0.
 */
const RUNTIME_PROFILES = [
  {
    runtimes: ["node-22.15.0"],
    suites: { viewer: ["node-22.15.0"], browser: ["node-22.15.0"] },
  },
  {
    runtimes: ["node-22.15.0", "node-24"],
    suites: { viewer: ["node-22.15.0", "node-24"], browser: ["node-22.15.0"] },
  },
];

/**
 * The runtimes of each suite in the profile that `runtimes` names. Throws for
 * an unsupported profile.
 */
export function suiteRuntimes(runtimes) {
  const profile = RUNTIME_PROFILES.find(
    (candidate) =>
      Array.isArray(runtimes) &&
      candidate.runtimes.length === runtimes.length &&
      candidate.runtimes.every((runtime, index) => runtime === runtimes[index]),
  );
  if (!profile)
    throw new Error(
      "unsupported CI runtime profile; expected node-22.15.0 or node-22.15.0,node-24",
    );
  return profile.suites;
}

/**
 * Validate one commit's complete CI evidence: every shard of each suite on
 * each runtime that the runtime profile selects for that suite. The shard
 * totals come from `ci-shards.json`, which the CI matrix and remote
 * verification also read. CI aggregation runs it, and the release evidence
 * check reruns it once the reports match the tagged tree, before it compares
 * their inventories with the tag checkout.
 */
export function validateCiReports(
  reports,
  commit,
  runtimes,
  totals = ciShards,
) {
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error("expected commit must be a full lowercase Git SHA");
  const suites = suiteRuntimes(runtimes);
  validateTotals(totals);
  const expected = SUITES.reduce(
    (sum, suite) => sum + suites[suite].length * totals[suite],
    0,
  );
  if (reports.length !== expected)
    throw new Error(
      `missing or extra CI evidence: expected ${expected} reports`,
    );
  for (const report of reports)
    if (
      !SUITES.includes(report.suite) ||
      !suites[report.suite].includes(report.runtime)
    )
      throw new Error("unexpected CI evidence group");
  for (const suite of SUITES)
    for (const runtime of suites[suite]) {
      const group = reports.filter(
        (report) => report.runtime === runtime && report.suite === suite,
      );
      try {
        validateShardReports(group, {
          commit,
          runtime,
          suite,
          total: totals[suite],
        });
      } catch (error) {
        throw new Error(
          `${suite} ${runtime} evidence failed: ${error.message}`,
          { cause: error },
        );
      }
    }
}

function validateTotals(totals) {
  for (const suite of SUITES)
    if (!Number.isSafeInteger(totals?.[suite]) || totals[suite] < 1)
      throw new Error(`invalid ${suite} shard total in ci-shards.json`);
}

export async function readReports(root) {
  const files = [];
  await collectJson(path.resolve(root), files);
  return await Promise.all(files.sort().map((file) => readReport(file)));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const args = process.argv.slice(2);
  if (
    args.length !== 6 ||
    args[0] !== "--reports" ||
    args[2] !== "--commit" ||
    args[4] !== "--runtimes"
  )
    throw new Error(
      "usage: aggregate.mjs --reports <directory> --commit <sha> --runtimes <runtime[,runtime]>",
    );
  const reports = await readReports(args[1]);
  validateCiReports(reports, args[3], args[5].split(","));
  const totalTests = reports.reduce(
    (total, report) =>
      total + report.observedFiles.reduce((sum, file) => sum + file.tests, 0),
    0,
  );
  process.stdout.write(
    `Validated ${reports.length} verification reports with ${totalTests} observed test results.\n`,
  );
}

async function collectJson(root, files) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) await collectJson(target, files);
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(target);
  }
}
