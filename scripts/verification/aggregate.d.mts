export function validateCiReports(
  reports: readonly unknown[],
  commit: string,
  runtimes: readonly string[],
  totals?: Readonly<CiShardTotals>,
): void;

/** Shards of each CI suite on every runtime, from `ci-shards.json`. */
export interface CiShardTotals {
  viewer: number;
  browser: number;
}

export function readReports(root: string): Promise<unknown[]>;
