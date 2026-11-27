import type { BudgetMode, BudgetRow } from "./ci-timing-budgets.mjs";
import type { CacheReport } from "./ci-timing-cache.mjs";
import type { CriticalPath } from "./ci-timing-path.mjs";
import type { ShardBalance } from "./ci-timing-shards.mjs";
import type { SlowFile, SlowTest } from "./ci-timing-tests.mjs";

export interface TimingReport {
  mode: BudgetMode;
  attempt: number;
  rows: BudgetRow[];
  path: CriticalPath | null;
  wallClockMinutes: number;
  /** Seconds above the wall-clock budget, or null when within it or not checked. */
  wallOverSeconds: number | null;
  /** The spread of each shard group, or null when it was not checked. */
  shards: ShardBalance[] | null;
  slowest: { tests: SlowTest[]; files: SlowFile[] };
  /** The Actions cache usage, or null when the report did not read it. */
  cache: CacheReport | null;
  issues: string[];
}

export function annotationLines(report: TimingReport): string[];

export function renderSummary(report: TimingReport): string;
