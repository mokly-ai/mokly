export const COVERAGE_SOURCE_ROOTS: readonly string[];

export const COVERAGE_GENERATED_ROOTS: readonly string[];

export type CoverageMetric = "lines" | "branches" | "functions";

export type CoverageThresholds = Readonly<Record<CoverageMetric, number>>;

export interface CoverageCounts {
  covered: number;
  total: number;
  percent: number;
}

export type CoverageTotals = Readonly<Record<CoverageMetric, CoverageCounts>>;

export interface CoverageFileRecord extends CoverageTotals {
  file: string;
}

export interface CoverageSelection {
  complete: boolean;
  files: string[];
}

export interface CoverageSummary {
  files: CoverageFileRecord[];
  totals: CoverageTotals;
  unmapped: CoverageFileRecord[];
}

export interface NodeCoverageFile {
  path: string;
  totalLineCount: number;
  coveredLineCount: number;
  totalBranchCount: number;
  coveredBranchCount: number;
  totalFunctionCount: number;
  coveredFunctionCount: number;
}

export interface NodeCoverageSummary {
  files: readonly NodeCoverageFile[];
}

export function coverageIncludeGlobs(): string[];

export function parseThresholds(value: unknown): CoverageThresholds;

export function selectCoverageFiles(
  fullFiles: readonly string[],
  argv: readonly string[],
): CoverageSelection;

export function summarizeCoverage(
  summary: NodeCoverageSummary,
  repositoryRoot: string,
): CoverageSummary;

export function evaluateThresholds(
  totals: CoverageTotals,
  thresholds: CoverageThresholds,
): string[];

export function formatCoverageSummary(
  summary: CoverageSummary,
  options?: { readonly lowest?: number },
): string[];
