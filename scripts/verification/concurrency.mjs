import os from "node:os";

/** Overrides how many Node test files run at once. */
export const UNIT_CONCURRENCY_VARIABLE = "MOKLY_UNIT_CONCURRENCY";

/** Overrides how many Playwright worker processes run at once. */
export const BROWSER_WORKERS_VARIABLE = "MOKLY_PLAYWRIGHT_WORKERS";

/** Node test files active at once: half the CPUs, never fewer than two. */
export function unitTestConcurrency(
  env = process.env,
  cpus = os.availableParallelism(),
) {
  return (
    configuredCount(env, UNIT_CONCURRENCY_VARIABLE) ??
    Math.max(2, Math.floor(cpus / 2))
  );
}

/** Playwright worker processes: one unless the environment overrides it. */
export function browserWorkerCount(env = process.env) {
  return configuredCount(env, BROWSER_WORKERS_VARIABLE) ?? 1;
}

/** Child environment for one Playwright suite; hydration uses half the CPUs. */
export function playwrightSuiteEnvironment(
  suite,
  env = process.env,
  cpus = os.availableParallelism(),
) {
  if (suite !== "hydration" || env[BROWSER_WORKERS_VARIABLE] !== undefined)
    return { ...env };
  return {
    ...env,
    [BROWSER_WORKERS_VARIABLE]: String(Math.max(1, Math.floor(cpus / 2))),
  };
}

function configuredCount(env, name) {
  const value = env[name];
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/u.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error(`${name} must be a positive integer; received ${value}`);
  return Number(value);
}
