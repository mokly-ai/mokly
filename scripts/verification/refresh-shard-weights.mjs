import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { fetchRunJobs, githubJson } from "./ci-timing-jobs.mjs";
import { jobLog, refreshTestSeconds } from "./rust-test-weights.mjs";
import { writeShardWeights } from "./shard-weights.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCRATCH = path.join(ROOT, ".context", "shard-weights");
const APP_PACKAGE = path.join(ROOT, "packages", "app");
const APP_JOB = /^App checks \d+\/(\d+)$/u;
const DEFAULT_RUNS = 5;
const MAX_RUNS = 100;
const USAGE = `usage: npm run ci:refresh-shard-weights -- [--runs {n}], where n is 1 to ${MAX_RUNS}`;

/**
 * The IDs of the newest runs of the CI workflow that a push to `main`
 * started and that passed, newest first.
 */
export async function greenMainRuns(request, count) {
  const body = await githubJson(
    request,
    `/repos/${request.repository}/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=${count}`,
  );
  const runs =
    typeof body === "object" &&
    body !== null &&
    Array.isArray(body.workflow_runs)
      ? body.workflow_runs
      : null;
  if (!runs) throw new Error("the workflow runs response has no runs array");
  return runs.flatMap((run) =>
    Number.isInteger(run?.id) ? [String(run.id)] : [],
  );
}

/**
 * The newest run in which every App checks shard passed, with the IDs of
 * those jobs, or null. The app weight script reads one complete run.
 */
export async function completeAppRun(request, runIds) {
  for (const runId of runIds) {
    const jobs = (await fetchRunJobs({ ...request, runId })).filter((job) =>
      APP_JOB.test(job?.name),
    );
    const total = Number(APP_JOB.exec(jobs[0]?.name ?? "")?.[1]);
    if (
      jobs.length === total &&
      jobs.every((job) => job.conclusion === "success")
    )
      return { runId, jobIds: jobs.map((job) => job.id) };
  }
  return null;
}

async function refreshReportWeights(repository, runIds) {
  const reports = path.join(SCRATCH, "reports");
  const used = [];
  for (const runId of runIds) {
    const download = spawnSync(
      "gh",
      [
        ...["run", "download", runId, "--repo", repository],
        ...["--pattern", "verification-*", "--dir", path.join(reports, runId)],
      ],
      { stdio: "inherit" },
    );
    if (download.status === 0) used.push(runId);
    else
      process.stderr.write(
        `Run ${runId} is left out of the browser and viewer weights: its reports could not be downloaded.\n`,
      );
  }
  const counts = await writeShardWeights(reports);
  return `Browser and viewer: ${counts.browser} specs and ${counts.viewer} files from ${used.length} runs.`;
}

async function refreshAppWeights(request, runIds) {
  const app = await completeAppRun(request, runIds);
  if (!app)
    return "App: no run passed every App checks shard; kept the weights.";
  const directory = path.join(SCRATCH, "app", app.runId);
  await fs.mkdir(directory, { recursive: true });
  const logs = [];
  for (const jobId of app.jobIds) {
    const file = path.join(directory, `${jobId}.log`);
    await fs.writeFile(file, await jobLog(request, jobId));
    logs.push(file);
  }
  const update = spawnSync(
    "npx",
    [
      "--no-install",
      "tsx",
      "src/_tests_/update-browser-shard-weights.ts",
    ].concat(logs),
    {
      cwd: APP_PACKAGE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  if (update.status !== 0)
    throw new Error(`the app weight update failed with ${update.status}`);
  return `App: from run ${app.runId}. ${update.stdout.trim()}`;
}

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const token = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  if (token.status !== 0 || !token.stdout.trim())
    throw new Error("set GITHUB_TOKEN or sign in with `gh auth login`");
  return token.stdout.trim();
}

/**
 * Refresh every measured shard weight file from the newest green `main`
 * runs: the browser and viewer weights, the Rust test seconds, and the app
 * browser weights. The Rust compile seconds come from a local build, and
 * the mockup shards have no weights.
 */
async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { runs: { type: "string", default: String(DEFAULT_RUNS) } },
    strict: true,
    allowPositionals: false,
  });
  const count = Number(values.runs);
  if (!Number.isInteger(count) || count < 1 || count > MAX_RUNS)
    throw new Error(USAGE);
  const request = {
    fetch: globalThis.fetch,
    apiUrl: process.env.GITHUB_API_URL || "https://api.github.com",
    repository: process.env.GITHUB_REPOSITORY || "mokly-ai/mokly",
    token: githubToken(),
  };
  const runIds = await greenMainRuns(request, count);
  if (runIds.length === 0) throw new Error("no green main run was found");
  await fs.rm(SCRATCH, { recursive: true, force: true });
  const lines = [`Runs, newest first: ${runIds.join(", ")}.`];
  lines.push(await refreshReportWeights(request.repository, runIds));
  const units = Object.entries(await refreshTestSeconds(request, runIds))
    .map(([host, count]) => `${count} on ${host}`)
    .join(", ");
  lines.push(
    `Rust tests: testSeconds of ${units} units. Refresh compileSeconds with \`node scripts/verification/rust-test-weights.mjs --compile\` after a build change.`,
  );
  lines.push(await refreshAppWeights(request, runIds));
  lines.push("Mockup: Playwright splits its shards by test count; no weights.");
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
)
  await main(process.argv.slice(2));
