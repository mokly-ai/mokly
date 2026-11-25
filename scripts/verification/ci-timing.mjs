import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { readReports } from "./aggregate.mjs";
import { evaluateJobs, parseBudgets } from "./ci-timing-budgets.mjs";
import { fetchRunJobs, parseJobs } from "./ci-timing-jobs.mjs";
import { criticalPath } from "./ci-timing-path.mjs";
import { annotationLines, renderSummary } from "./ci-timing-summary.mjs";
import { slowestTests } from "./ci-timing-tests.mjs";

const DEFAULT_BUDGETS = path.join(import.meta.dirname, "ci-budgets.json");
const USAGE =
  "usage: ci-timing.mjs [--budgets {file}] [--reports {directory}] [--self {job name}] [--jobs-file {file}]";

/**
 * Report each job's run time against its budget, the critical path, and the
 * slowest tests. It writes the Markdown to `GITHUB_STEP_SUMMARY`, or to
 * standard output when that is unset, and prints one workflow annotation for
 * each finding. It returns 1 only in `fail` mode, for an overrun or for a
 * report that could not run. In `warn` mode it always returns 0.
 */
export async function runCiTiming({ argv, env, fetch, write }) {
  let mode = "warn";
  try {
    const options = parseOptions(argv);
    const budgets = parseBudgets(await readJson(options.budgets));
    mode = budgets.mode;
    const entries = options.jobsFile
      ? jobEntries(await readJson(options.jobsFile))
      : await fetchRunJobs(apiOptions(env, fetch));
    const report = await buildReport(entries, budgets, options, env);
    await publish(renderSummary(report), env, write);
    for (const line of annotationLines(report)) write.stdout(`${line}\n`);
    const overrun =
      report.wallOverSeconds !== null ||
      report.rows.some((row) => row.state === "over");
    return mode === "fail" && overrun ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const level = mode === "fail" ? "error" : "warning";
    write.stdout(
      `::${level} title=CI timing report::${message.replace(/[\r\n%]/g, " ")}\n`,
    );
    await publish(
      `## CI timing\n\nThe report could not run: ${message}\n`,
      env,
      write,
    );
    return mode === "fail" ? 1 : 0;
  }
}

async function buildReport(entries, budgets, options, env) {
  const parsed = parseJobs(entries);
  const issues = [...parsed.issues];
  const pending = parsed.jobs.filter(
    (job) => job.status !== "completed" && job.name !== options.self,
  );
  for (const job of pending)
    issues.push(
      `${job.name} was ${job.status} when the report ran, so it has no duration.`,
    );
  const jobs = parsed.jobs.filter(
    (job) => job.status === "completed" && job.name !== options.self,
  );
  const rows = evaluateJobs(jobs, budgets);
  const critical = criticalPath(jobs);
  const firstAttempt = critical !== null && critical.reusedJobs === 0;
  const overSeconds = critical
    ? critical.wallSeconds - budgets.wallClockMinutes * 60
    : 0;
  return {
    mode: budgets.mode,
    attempt:
      Number(env.GITHUB_RUN_ATTEMPT) ||
      Math.max(1, ...jobs.map((job) => job.attempt)),
    rows,
    path: critical,
    wallClockMinutes: budgets.wallClockMinutes,
    wallOverSeconds: firstAttempt && overSeconds > 0 ? overSeconds : null,
    slowest: slowestTests(
      await reports(options.reports, issues),
      budgets.slowestTests,
    ),
    issues,
  };
}

async function reports(directory, issues) {
  if (!directory) return [];
  try {
    await fs.access(directory);
  } catch {
    return [];
  }
  try {
    return await readReports(directory);
  } catch (error) {
    issues.push(`The verification reports could not be read: ${error.message}`);
    return [];
  }
}

function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      budgets: { type: "string", default: DEFAULT_BUDGETS },
      reports: { type: "string" },
      self: { type: "string" },
      "jobs-file": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  return {
    budgets: values.budgets,
    reports: values.reports ?? null,
    self: values.self ?? null,
    jobsFile: values["jobs-file"] ?? null,
  };
}

function apiOptions(env, fetch) {
  for (const name of ["GITHUB_TOKEN", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"])
    if (!env[name]) throw new Error(`${name} is not set. ${USAGE}`);
  return {
    fetch,
    apiUrl: env.GITHUB_API_URL || "https://api.github.com",
    repository: env.GITHUB_REPOSITORY,
    runId: env.GITHUB_RUN_ID,
    token: env.GITHUB_TOKEN,
  };
}

function jobEntries(body) {
  if (typeof body === "object" && body !== null && Array.isArray(body.jobs))
    return body.jobs;
  throw new Error(
    "the jobs file must hold a GitHub jobs response with a jobs array",
  );
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${file} could not be read as JSON: ${error.message}`, {
      cause: error,
    });
  }
}

async function publish(markdown, env, write) {
  if (env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(env.GITHUB_STEP_SUMMARY, markdown);
  else write.stdout(markdown);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  process.exitCode = await runCiTiming({
    argv: process.argv.slice(2),
    env: process.env,
    fetch: globalThis.fetch,
    write: { stdout: (text) => process.stdout.write(text) },
  });
}
