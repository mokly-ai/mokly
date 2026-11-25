import { parseCacheBudget } from "./ci-timing-cache.mjs";
import { jobSeconds } from "./ci-timing-jobs.mjs";

/** `warn` reports budget overruns as warnings; `fail` also fails the step. */
const BUDGET_MODES = ["warn", "fail"];

/**
 * Narrow the budget file. Patterns match whole job names, `*` matches any
 * run of characters, and the first matching pattern wins.
 */
export function parseBudgets(value) {
  if (!isRecord(value)) throw new Error("the budget file must hold an object");
  if (!BUDGET_MODES.includes(value.mode))
    throw new Error(`budget mode must be one of ${BUDGET_MODES.join(", ")}`);
  const wallClockMinutes = positive(value.wallClockMinutes, "wallClockMinutes");
  const slowestTests = value.slowestTests;
  if (!Number.isInteger(slowestTests) || slowestTests < 0)
    throw new Error("slowestTests must be a whole number of zero or more");
  if (!Array.isArray(value.jobs) || value.jobs.length === 0)
    throw new Error("jobs must list at least one budget");
  const jobs = value.jobs.map((budget, index) => {
    if (
      !isRecord(budget) ||
      typeof budget.pattern !== "string" ||
      !budget.pattern
    )
      throw new Error(`jobs[${index}] needs a pattern`);
    return {
      pattern: budget.pattern,
      minutes: positive(budget.minutes, `jobs[${index}].minutes`),
    };
  });
  const cache = parseCacheBudget(value.cache);
  return { mode: value.mode, wallClockMinutes, slowestTests, jobs, cache };
}

/** The first budget whose pattern matches the whole job name, or null. */
export function matchBudget(name, budgets) {
  return (
    budgets.jobs.find((budget) => pattern(budget.pattern).test(name)) ?? null
  );
}

/**
 * Compare each job's run time, from start to completion, with its budget.
 * Queue time is outside the budget. A skipped job, or a job that never
 * started, is `not-run` and has no budget check.
 */
export function evaluateJobs(jobs, budgets) {
  return jobs
    .map((job) => {
      const seconds = jobSeconds(job);
      const budget = matchBudget(job.name, budgets);
      const slowestStep = job.steps.reduce(
        (slowest, step) =>
          slowest === null || step.seconds > slowest.seconds ? step : slowest,
        null,
      );
      const ran = seconds !== null && job.conclusion !== "skipped";
      const state = !ran
        ? "not-run"
        : budget === null
          ? "no-budget"
          : seconds > budget.minutes * 60
            ? "over"
            : "within";
      return { job, seconds, budget, state, slowestStep };
    })
    .sort(
      (left, right) =>
        (right.seconds ?? -1) - (left.seconds ?? -1) ||
        left.job.name.localeCompare(right.job.name),
    );
}

function pattern(source) {
  const escaped = source
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join(".*")}$`, "s");
}

function positive(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be a positive number of minutes`);
  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
