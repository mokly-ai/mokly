import type { TimedJob, TimedStep } from "./ci-timing-jobs.mjs";

export const BUDGET_MODES: readonly ["warn", "fail"];

export type BudgetMode = (typeof BUDGET_MODES)[number];

export interface JobBudget {
  pattern: string;
  minutes: number;
}

export interface Budgets {
  mode: BudgetMode;
  wallClockMinutes: number;
  slowestTests: number;
  jobs: JobBudget[];
}

export type BudgetState = "within" | "over" | "no-budget" | "not-run";

export interface BudgetRow {
  job: TimedJob;
  seconds: number | null;
  budget: JobBudget | null;
  state: BudgetState;
  slowestStep: TimedStep | null;
}

export function parseBudgets(value: unknown): Budgets;

export function matchBudget(name: string, budgets: Budgets): JobBudget | null;

export function evaluateJobs(
  jobs: readonly TimedJob[],
  budgets: Budgets,
): BudgetRow[];
