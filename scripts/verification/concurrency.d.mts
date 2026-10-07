/** Environment values the concurrency defaults read. */
export type ConcurrencyEnvironment = Readonly<
  Record<string, string | undefined>
>;

/** Overrides how many Node test files run at once. */
export const UNIT_CONCURRENCY_VARIABLE: "MOKLY_UNIT_CONCURRENCY";

/** Overrides how many Playwright worker processes run at once. */
export const BROWSER_WORKERS_VARIABLE: "MOKLY_PLAYWRIGHT_WORKERS";

/** Node test files active at once: half the CPUs, never fewer than two. */
export function unitTestConcurrency(
  env?: ConcurrencyEnvironment,
  cpus?: number,
): number;

/** Playwright worker processes: one unless the environment overrides it. */
export function browserWorkerCount(env?: ConcurrencyEnvironment): number;

/** Child environment for one Playwright suite; hydration uses half the CPUs. */
export function playwrightSuiteEnvironment(
  suite: "browser" | "hydration",
  env?: ConcurrencyEnvironment,
  cpus?: number,
): Record<string, string | undefined>;
