import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { fetchRunJobs } from "./ci-timing-jobs.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WEIGHTS = path.join(import.meta.dirname, "rust-test-weights.json");
const USAGE = "usage: rust-test-weights.mjs [--run {id}]... [--compile]";
// A unit's compile weight is its build time in the timing report times this
// factor, as the verification README defines.
const COMPILE_FACTOR = 1.5;
const RESULT_LINE =
  /\s(?:PASS|LEAK|LEAK-PASS)\s+\[\s*(\d+(?:\.\d+)?)s\]\s+(?:\(\s*\d+\/\d+\)\s+)?(\S+)\s+(\S+)/u;

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

/**
 * The passed tests of one job log: the unit, the test identity (its binary
 * ID and name), and its nextest seconds.
 */
export function logTests(log) {
  const tests = [];
  for (const line of log.split("\n")) {
    const match = RESULT_LINE.exec(line);
    if (!match) continue;
    tests.push({
      unit: unitOfBinary(match[2]),
      test: `${match[2]} ${match[3]}`,
      seconds: Number(match[1]),
    });
  }
  return tests;
}

/**
 * The test seconds of each unit from samples of
 * `{ run, host, unit, test, seconds }`: the median of each test over the runs
 * of a host that observed it, the sum over the tests of a unit and host, then
 * the mean over the hosts, rounded. A run that lacks a job, such as a failed
 * or unfinished test shard, only lowers the sample count of that job's tests.
 */
export function testSeconds(samples) {
  const runs = new Map();
  for (const { host, unit, test, seconds } of samples) {
    const key = JSON.stringify([unit, host, test]);
    runs.set(key, [...(runs.get(key) ?? []), seconds]);
  }
  const hosts = new Map();
  for (const [key, values] of runs) {
    const [unit, host] = JSON.parse(key);
    const hostKey = JSON.stringify([unit, host]);
    hosts.set(hostKey, (hosts.get(hostKey) ?? 0) + median(values));
  }
  const units = new Map();
  for (const [key, seconds] of hosts) {
    const [unit] = JSON.parse(key);
    units.set(unit, [...(units.get(unit) ?? []), seconds]);
  }
  return sortedObject(units, (values) => Math.round(mean(values)));
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
  if (seconds.size === 0)
    throw new Error("the cargo timing report built no test target");
  return sortedObject(seconds, (value) => Math.round(value * COMPILE_FACTOR));
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

// Cargo leaves a build that it reuses out of its timing report, so the
// measurement builds every test target in a target directory of its own.
async function measureCompile() {
  const target = await fs.mkdtemp(
    path.join(ROOT, ".context", "rust-test-weights-"),
  );
  try {
    const build = spawnSync(
      "cargo",
      [
        "test",
        "--locked",
        "--no-run",
        "--timings",
        "-p",
        "mokly-*",
        "-p",
        "xtask",
        "--target-dir",
        target,
      ],
      {
        cwd: ROOT,
        stdio: "inherit",
        env: {
          ...process.env,
          CARGO_INCREMENTAL: "0",
          CARGO_PROFILE_DEV_DEBUG: "0",
          CARGO_PROFILE_TEST_DEBUG: "0",
        },
      },
    );
    if (build.status !== 0)
      throw new Error(`cargo test --no-run failed with ${build.status}`);
    return compileSeconds(
      await fs.readFile(
        path.join(target, "cargo-timings", "cargo-timing.html"),
        "utf8",
      ),
    );
  } finally {
    await fs.rm(target, { recursive: true, force: true });
  }
}

async function runSamples(request) {
  const samples = [];
  for (const job of await fetchRunJobs(request)) {
    const host = testHost(job.name);
    if (!host || job.conclusion !== "success") continue;
    const log = await githubText(
      request,
      `/repos/${request.repository}/actions/jobs/${job.id}/logs`,
    );
    for (const test of logTests(log))
      samples.push({ run: request.runId, host, ...test });
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

function sortedObject(map, value) {
  return Object.fromEntries(
    [...map]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, value(entry)]),
  );
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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const { values } = parseArgs({
    options: {
      run: { type: "string", multiple: true, default: [] },
      compile: { type: "boolean", default: false },
    },
  });
  if (values.run.length === 0 && !values.compile) throw new Error(USAGE);
  const weights = JSON.parse(await fs.readFile(WEIGHTS, "utf8"));
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
  if (values.compile) weights.compileSeconds = await measureCompile();
  await fs.writeFile(WEIGHTS, `${JSON.stringify(weights, null, 2)}\n`);
  for (const part of ["compileSeconds", "testSeconds"])
    process.stdout.write(
      `${part}: ${Object.keys(weights[part] ?? {}).length} units\n`,
    );
}
