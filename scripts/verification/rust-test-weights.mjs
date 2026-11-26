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
// The CI hosts of the Rust test shards, each with its own test seconds.
const HOSTS = ["linux", "macos", "windows"];
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
 * The test seconds of each unit on each host from samples of
 * `{ run, host, unit, test, seconds }`: the median of each test over the runs
 * of a host that observed it, then the sum over the tests of a unit on that
 * host, rounded. A run that lacks a job, such as a failed or unfinished test
 * shard, only lowers the sample count of that job's tests on its host.
 */
export function testSeconds(samples) {
  const runs = new Map();
  for (const { host, unit, test, seconds } of samples) {
    const key = JSON.stringify([host, unit, test]);
    runs.set(key, [...(runs.get(key) ?? []), seconds]);
  }
  const hosts = new Map();
  for (const [key, values] of runs) {
    const [host, unit] = JSON.parse(key);
    const units = hosts.get(host) ?? new Map();
    units.set(unit, (units.get(unit) ?? 0) + median(values));
    hosts.set(host, units);
  }
  return sortedObject(hosts, (units) => sortedObject(units, Math.round));
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
  const scratch = path.join(ROOT, ".context");
  await fs.mkdir(scratch, { recursive: true });
  const target = await fs.mkdtemp(path.join(scratch, "rust-test-weights-"));
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
    if (build.error) throw build.error;
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

/**
 * Replace the test seconds of each host in the weight file with the times of
 * the passed Repository and native test jobs of the given runs. A host that
 * no given run measured keeps its committed test seconds. Resolve to the
 * number of units of each host.
 */
export async function refreshTestSeconds(request, runIds) {
  const samples = [];
  for (const runId of runIds)
    samples.push(...(await runSamples({ ...request, runId })));
  if (samples.length === 0)
    throw new Error("the runs have no passed Rust test shard logs");
  const weights = JSON.parse(await fs.readFile(WEIGHTS, "utf8"));
  const measured = testSeconds(samples);
  weights.testSeconds = Object.fromEntries(
    HOSTS.flatMap((host) => {
      const units = measured[host] ?? weights.testSeconds?.[host];
      return units ? [[host, units]] : [];
    }),
  );
  await fs.writeFile(WEIGHTS, `${JSON.stringify(weights, null, 2)}\n`);
  return Object.fromEntries(
    Object.entries(weights.testSeconds).map(([host, units]) => [
      host,
      Object.keys(units).length,
    ]),
  );
}

async function runSamples(request) {
  const samples = [];
  for (const job of await fetchRunJobs(request)) {
    const host = testHost(job.name);
    if (!host || job.conclusion !== "success") continue;
    for (const test of logTests(await jobLog(request, job.id)))
      samples.push({ run: request.runId, host, ...test });
  }
  return samples;
}

/** The plain-text log of one Actions job. */
export async function jobLog({ fetch, apiUrl, repository, token }, jobId) {
  const requestPath = `/repos/${repository}/actions/jobs/${jobId}/logs`;
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
  if (values.run.length > 0) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error(`GITHUB_TOKEN is not set. ${USAGE}`);
    await refreshTestSeconds(
      {
        fetch,
        apiUrl: process.env.GITHUB_API_URL || "https://api.github.com",
        repository: process.env.GITHUB_REPOSITORY || "mokly-ai/mokly",
        token,
      },
      values.run,
    );
  }
  if (values.compile) {
    const weights = JSON.parse(await fs.readFile(WEIGHTS, "utf8"));
    weights.compileSeconds = await measureCompile();
    await fs.writeFile(WEIGHTS, `${JSON.stringify(weights, null, 2)}\n`);
  }
  const weights = JSON.parse(await fs.readFile(WEIGHTS, "utf8"));
  process.stdout.write(
    `compileSeconds: ${Object.keys(weights.compileSeconds ?? {}).length} units\n`,
  );
  for (const [host, units] of Object.entries(weights.testSeconds ?? {}))
    process.stdout.write(
      `testSeconds on ${host}: ${Object.keys(units).length} units\n`,
    );
}
