export interface ExpectedShardGroup {
  commit: string;
  runtime: string;
  suite: "unit" | "browser";
  total: number;
}

export function validateCompletedReport(report: unknown): void;

export function validateShardReports(
  reports: readonly unknown[],
  expected: ExpectedShardGroup,
): void;
