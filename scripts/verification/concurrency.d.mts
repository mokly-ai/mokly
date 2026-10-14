/** Environment values the concurrency defaults read. */
export type ConcurrencyEnvironment = Readonly<
  Record<string, string | undefined>
>;

/** Overrides how many Node test files run at once. */
export const UNIT_CONCURRENCY_VARIABLE: "MOKLY_UNIT_CONCURRENCY";

/** Node test files active at once: half the CPUs, never fewer than two. */
export function unitTestConcurrency(
  env?: ConcurrencyEnvironment,
  cpus?: number,
): number;
