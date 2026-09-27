import fs from "node:fs/promises";
import path from "node:path";

import { readReport } from "./evidence.mjs";
import { validateShardReports } from "./report-validation.mjs";

const RUNTIME_PROFILES = [["node-22.14.0"], ["node-22.14.0", "node-24"]];
const SUITES = ["unit", "browser"];
const SHARDS = 4;

export function validateCiReports(reports, commit, runtimes) {
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error("expected commit must be a full lowercase Git SHA");
  validateRuntimeProfile(runtimes);
  const expectedKeys = new Set(
    SUITES.flatMap((suite) => runtimes.map((runtime) => `${suite}:${runtime}`)),
  );
  if (reports.length !== expectedKeys.size * SHARDS)
    throw new Error(
      `missing or extra CI evidence: expected ${expectedKeys.size * SHARDS} reports`,
    );
  for (const report of reports) {
    const key = `${report.suite}:${report.runtime}`;
    if (!expectedKeys.has(key))
      throw new Error(`unexpected CI evidence group ${key}`);
  }
  for (const suite of SUITES) {
    for (const runtime of runtimes) {
      const group = reports.filter(
        (report) => report.suite === suite && report.runtime === runtime,
      );
      try {
        validateShardReports(group, {
          commit,
          runtime,
          suite,
          total: SHARDS,
        });
      } catch (error) {
        throw new Error(
          `${suite} ${runtime} evidence failed: ${error.message}`,
          {
            cause: error,
          },
        );
      }
    }
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
    `Validated ${reports.length} shard reports with ${totalTests} observed test results.\n`,
  );
}

async function collectJson(root, files) {
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) await collectJson(target, files);
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(target);
  }
}
