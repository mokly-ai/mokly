import fs from "node:fs/promises";
import path from "node:path";

import { readReport } from "./evidence.mjs";
import {
  validateUnshardedReport,
  validateShardReports,
} from "./report-validation.mjs";

const RUNTIME_PROFILES = [["node-22.14.0"], ["node-22.14.0", "node-24"]];
export function validateCiReports(reports, commit, runtimes) {
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error("expected commit must be a full lowercase Git SHA");
  validateRuntimeProfile(runtimes);
  if (reports.length !== runtimes.length * 5)
    throw new Error(
      `missing or extra CI evidence: expected ${runtimes.length * 5} reports`,
    );
  for (const report of reports)
    if (
      !["viewer", "browser"].includes(report.suite) ||
      !runtimes.includes(report.runtime)
    )
      throw new Error("unexpected CI evidence group");
  for (const runtime of runtimes) {
    const group = reports.filter(
      (report) => report.runtime === runtime && report.suite === "viewer",
    );
    if (group.length !== 1)
      throw new Error(
        `viewer ${runtime} evidence failed: expected exactly one report`,
      );
    validateUnshardedReport(group[0], { commit, runtime, suite: "viewer" });
    const browser = reports.filter(
      (report) => report.runtime === runtime && report.suite === "browser",
    );
    try {
      validateShardReports(browser, {
        commit,
        runtime,
        suite: "browser",
        total: 4,
      });
    } catch (error) {
      throw new Error(`browser ${runtime} evidence failed: ${error.message}`, {
        cause: error,
      });
    }
    if (browser.some((report) => report.nodeVersion !== group[0].nodeVersion))
      throw new Error("suites used different Node versions");
  }
}

function validateRuntimeProfile(runtimes) {
  const supported =
    Array.isArray(runtimes) &&
    RUNTIME_PROFILES.some(
      (profile) =>
        profile.length === runtimes.length &&
        profile.every((runtime, index) => runtime === runtimes[index]),
    );
  if (!supported)
    throw new Error(
      "unsupported CI runtime profile; expected node-22.14.0 or node-22.14.0,node-24",
    );
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
