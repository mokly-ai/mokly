export function validateCompletedReport(
  report: unknown,
  options?: { allowUnitSkips?: boolean },
): void;
export function validateUnshardedReport(
  report: unknown,
  expected: {
    commit: string;
    runtime: string;
    suite: "viewer" | "browser";
  },
): void;

export function validateShardReports(
  reports: readonly unknown[],
  expected: {
    commit: string;
    runtime: string;
    suite: "browser";
    total: number;
  },
): void;
