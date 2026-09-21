export function validateCiReports(
  reports: readonly unknown[],
  commit: string,
): void;

export function readReports(root: string): Promise<unknown[]>;
