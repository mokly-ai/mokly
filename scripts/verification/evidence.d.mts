export interface VerificationShard {
  index: number;
  total: number;
}
export interface VerificationIdentity {
  commit: string;
  runtime: string;
  nodeVersion: string;
}

export function discoverNodeFiles(repositoryRoot: string): Promise<string[]>;
export function verificationIdentity(
  repositoryRoot: string,
): Promise<VerificationIdentity>;
export function defaultReportPath(
  repositoryRoot: string,
  suite?: string,
  shard?: { index: number; total: number } | null,
): string;
export function writeReport(file: string, report: unknown): Promise<void>;
export function readReport(file: string): Promise<unknown>;

export function discoverBrowserFiles(repositoryRoot: string): Promise<string[]>;
