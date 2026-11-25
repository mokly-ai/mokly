import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { fetchRunJobs } from "./ci-timing-jobs.mjs";

const WEIGHTS = path.join(import.meta.dirname, "rust-test-weights.json");
const USAGE =
  "usage: rust-test-weights.mjs [--run {id}]... [--timings {cargo-timing.html}]";
// A unit's compile weight is its build time in the timing report times this
// factor, as the verification README defines.
const COMPILE_FACTOR = 1.5;
const RESULT_LINE =
  /\s(?:PASS|LEAK|LEAK-PASS)\s+\[\s*(\d+(?:\.\d+)?)s\]\s+(?:\(\s*\d+\/\d+\)\s+)?(\S+)\s/u;

/**
 * The CI host of a Rust test job, from its job name, or null for a job that
 * runs no Rust test shard.
 */
export function testHost(jobName) {
  if (/^Repository \(shard \d+\/\d+\)$/u.test(jobName)) return "linux";
  const native = /^Native \((macos|windows)-[\w.-]+, shard \d+\/\d+\)$/u.exec(
    jobName,
  );
  return native ? native[1] : null;
}

/**
 * The test unit of a nextest binary ID: `crate` is `--lib`,
 * `crate::bin/name` is `--bin name`, and `crate::name` is `--test name`.
 */
function unitOfBinary(binaryId) {
  const separator = binaryId.indexOf("::");
  if (separator < 0) return "--lib";
  const target = binaryId.slice(separator + 2);
  return target.startsWith("bin/")
    ? `--bin ${target.slice(4)}`
    : `--test ${target}`;
}

/** The summed nextest test seconds of each unit in one job log. */
export function logUnitSeconds(log) {
  const seconds = new Map();
  for (const line of log.split("\n")) {
    const match = RESULT_LINE.exec(line);
    if (!match) continue;
    const unit = unitOfBinary(match[2]);
    seconds.set(unit, (seconds.get(unit) ?? 0) + Number(match[1]));
  }
  return seconds;
}

/**
 * The test seconds of each unit from samples of `{ run, host, unit, seconds }`
 * with one sample for each job: the sum over the jobs of a run and host, the
 * median over the runs of a host, then the mean over the hosts, rounded.
 */
export function testSeconds(samples) {
  const sums = new Map();
  for (const { run, host, unit, seconds } of samples) {
    const key = JSON.stringify([unit, host, run]);
    sums.set(key, (sums.get(key) ?? 0) + seconds);
  }
  const byHost = new Map();
  for (const [key, seconds] of sums) {
    const [unit, host] = JSON.parse(key);
    const hostKey = JSON.stringify([unit, host]);
    byHost.set(hostKey, [...(byHost.get(hostKey) ?? []), seconds]);
  }
  const hosts = new Map();
  for (const [key, values] of byHost) {
    const [unit] = JSON.parse(key);
    hosts.set(unit, [...(hosts.get(unit) ?? []), median(values)]);
  }
  return Object.fromEntries(
    [...hosts]
      .sort(([left], [right]) => compare(left, right))
      .map(([unit, values]) => [unit, Math.round(mean(values))]),
  );
}

/**
 * The compile weight of each unit from the HTML report of
 * `cargo test --no-run --timings`: the summed build seconds of the test
 * targets of the unit, times the compile factor, rounded.
 */
export function compileSeconds(html) {
  const data = /const UNIT_DATA = (\[.*?\]);\n/su.exec(html);
  if (!data) throw new Error("the cargo timing report has no UNIT_DATA");
  const seconds = new Map();
  for (const unit of JSON.parse(data[1])) {
    const key = timingUnit(unit.target);
    if (key) seconds.set(key, (seconds.get(key) ?? 0) + unit.duration);
  }
  return Object.fromEntries(
    [...seconds]
      .sort(([left], [right]) => compare(left, right))
      .map(([unit, value]) => [unit, Math.round(value * COMPILE_FACTOR)]),
  );
}

// Cargo names each test build ` {target} "{kind}" (test)`: kind `lib` for the
// unit tests of a library, `bin` for those of a binary, and `test` for an
// integration test. Other builds make no test binary.
function timingUnit(target) {
  const match = /^ (\S+) "(lib|bin|test)" \(test\)$/u.exec(target);
  if (!match) return null;
  const [, name, kind] = match;
  return kind === "lib" ? "--lib" : `--${kind} ${name}`;
}

async function runSamples(request) {
  const samples = [];
  const jobs = await fetchRunJobs(request);
  for (const job of jobs) {
    const host = testHost(job.name);
    if (!host || job.conclusion !== "success") continue;
    const log = await githubText(
      request,
      `/repos/${request.repository}/actions/jobs/${job.id}/logs`,
    );
    for (const [unit, seconds] of logUnitSeconds(log))
      samples.push({ run: request.runId, host, unit, seconds });
  }
  return samples;
}

async function githubText({ fetch, apiUrl, token }, requestPath) {
  const response = await fetch(`${apiUrl}${requestPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mokly-rust-test-weights",
    },
  });
  if (!response.ok)
    throw new Error(`GitHub GET ${requestPath} failed (${response.status})`);
  return await response.text();
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const { values } = parseArgs({
    options: {
      run: { type: "string", multiple: true, default: [] },
      timings: { type: "string" },
    },
  });
  if (values.run.length === 0 && !values.timings) throw new Error(USAGE);
  const weights = JSON.parse(await fs.readFile(WEIGHTS, "utf8"));
  if (values.timings)
    weights.compileSeconds = compileSeconds(
      await fs.readFile(values.timings, "utf8"),
    );
  if (values.run.length > 0) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error(`GITHUB_TOKEN is not set. ${USAGE}`);
    const samples = [];
    for (const runId of values.run)
      samples.push(
        ...(await runSamples({
          fetch,
          apiUrl: process.env.GITHUB_API_URL || "https://api.github.com",
          repository: process.env.GITHUB_REPOSITORY || "mokly-ai/mokly",
          runId,
          token,
        })),
      );
    if (samples.length === 0)
      throw new Error("the runs have no passed Rust test shard logs");
    weights.testSeconds = testSeconds(samples);
  }
  await fs.writeFile(WEIGHTS, `${JSON.stringify(weights, null, 2)}\n`);
  for (const part of ["compileSeconds", "testSeconds"])
    process.stdout.write(
      `${part}: ${Object.keys(weights[part] ?? {}).length} units\n`,
    );
}
