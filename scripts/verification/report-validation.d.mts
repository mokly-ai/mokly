export interface ExpectedShardGroup {
  commit: string;
  runtime: string;
  suite: "unit" | "browser";
  total: number;
}

/** Only the public developer unit runner may tolerate skipped or todo tests. */
export interface CompletedReportOptions {
  allowUnitSkips?: boolean;
}

/** Validate complete evidence; strict by default for gate and shard reports. */
export function validateCompletedReport(
  report: unknown,
  options?: CompletedReportOptions,
): void;

export function validateShardReports(
  reports: readonly unknown[],
  expected: ExpectedShardGroup,
): void;
