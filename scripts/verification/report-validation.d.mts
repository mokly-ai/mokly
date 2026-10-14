export function validateCompletedReport(
  report: unknown,
  options?: { allowUnitSkips?: boolean },
): void;
export function validateUnshardedReport(
  report: unknown,
  expected: {
    commit: string;
    runtime: string;
    suite: "viewer";
  },
): void;
