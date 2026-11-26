import type { GitHubRequest } from "./ci-timing-jobs.mjs";

/** The CI host of a Rust test job name, or null for another job. */
export function testHost(jobName: string): "linux" | "macos" | "windows" | null;

/** One passed test of a job log. */
export interface LoggedTest {
  unit: string;
  test: string;
  seconds: number;
}

/** The passed tests of one job log with their nextest seconds. */
export function logTests(log: string): LoggedTest[];

/** One passed test of one job of one run. */
export interface TestSample extends LoggedTest {
  run: string;
  host: string;
}

/** The rounded test seconds of each unit, keyed by host, then by unit. */
export function testSeconds(
  samples: readonly TestSample[],
): Record<string, Record<string, number>>;

/** The rounded compile weight of each unit from a cargo timing report. */
export function compileSeconds(html: string): Record<string, number>;

/**
 * Replace the test seconds of each measured host from the passed Rust test
 * jobs of the given runs; resolve to the number of units of each host.
 */
export function refreshTestSeconds(
  request: GitHubRequest,
  runIds: readonly string[],
): Promise<Record<string, number>>;

/** The plain-text log of one Actions job. */
export function jobLog(request: GitHubRequest, jobId: number): Promise<string>;
