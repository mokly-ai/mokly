/** The CI host of a Rust test job name, or null for another job. */
export function testHost(jobName: string): "linux" | "macos" | "windows" | null;

/** The summed nextest test seconds of each unit in one job log. */
export function logUnitSeconds(log: string): Map<string, number>;

/** One job's summed test seconds of one unit. */
export interface TestSample {
  run: string;
  host: string;
  unit: string;
  seconds: number;
}

/** The rounded test seconds of each unit, keyed by unit. */
export function testSeconds(
  samples: readonly TestSample[],
): Record<string, number>;

/** The rounded compile weight of each unit from a cargo timing report. */
export function compileSeconds(html: string): Record<string, number>;
