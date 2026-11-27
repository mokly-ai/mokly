export function validateCompletedReport(
  report: unknown,
  options?: { allowUnitSkips?: boolean },
): void;
export function validateShardReports(
  reports: readonly unknown[],
  expected: {
    commit: string;
    runtime: string;
    suite: "viewer" | "browser";
    total: number;
  },
): void;
