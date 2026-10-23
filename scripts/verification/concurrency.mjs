import os from "node:os";

/** Overrides how many Node test files run at once. */
export const UNIT_CONCURRENCY_VARIABLE = "MOKLY_UNIT_CONCURRENCY";

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

/** Playwright workers, each with its own Serve process. */
export function browserWorkerCount(env = process.env) {
  return configuredCount(env, "MOKLY_PLAYWRIGHT_WORKERS") ?? 1;
}

function configuredCount(env, name) {
  const value = env[name];
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/u.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error(`${name} must be a positive integer; received ${value}`);
  return Number(value);
}
