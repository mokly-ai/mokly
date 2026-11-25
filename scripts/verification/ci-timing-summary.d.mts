import type { BudgetMode, BudgetRow } from "./ci-timing-budgets.mjs";
import type { CriticalPath } from "./ci-timing-path.mjs";
import type { SlowFile, SlowTest } from "./ci-timing-tests.mjs";

export interface TimingReport {
  mode: BudgetMode;
  attempt: number;
  rows: BudgetRow[];
  path: CriticalPath | null;
  wallClockMinutes: number;
  /** Seconds above the wall-clock budget, or null when within it or not checked. */
  wallOverSeconds: number | null;
  slowest: { tests: SlowTest[]; files: SlowFile[] };
  issues: string[];
}

export function annotationLines(report: TimingReport): string[];

export function renderSummary(report: TimingReport): string;
