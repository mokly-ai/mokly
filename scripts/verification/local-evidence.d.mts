export interface LocalEvidenceExpectation {
  readonly commit: string;
  readonly runtime: string;
  readonly unitFiles: readonly string[];
  readonly browserTests: readonly { readonly id: string }[];
}

export function validateLocalReports(
  reports: readonly unknown[],
  expected: LocalEvidenceExpectation,
): void;
