export function validateCiReports(
  reports: readonly unknown[],
  commit: string,
  runtimes: readonly string[],
): void;

export function readReports(root: string): Promise<unknown[]>;
