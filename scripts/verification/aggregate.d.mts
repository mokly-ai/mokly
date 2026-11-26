export function validateCiReports(
  reports: readonly unknown[],
  commit: string,
  runtimes: readonly string[],
  totals?: Readonly<CiShardTotals>,
): void;

/** The runtimes of each suite in one CI runtime profile. */
export interface CiSuiteRuntimes {
  viewer: readonly string[];
  browser: readonly string[];
}

export function suiteRuntimes(runtimes: readonly string[]): CiSuiteRuntimes;

/** Shards of each CI suite on every runtime, from `ci-shards.json`. */
export interface CiShardTotals {
  viewer: number;
  browser: number;
}

export function readReports(root: string): Promise<unknown[]>;
