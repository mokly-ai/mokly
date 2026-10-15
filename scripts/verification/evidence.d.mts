export interface VerificationIdentity {
  commit: string;
  runtime: string;
  nodeVersion: string;
}

export function discoverNodeFiles(repositoryRoot: string): Promise<string[]>;
export function verificationIdentity(
  repositoryRoot: string,
): Promise<VerificationIdentity>;
export function defaultReportPath(repositoryRoot: string): string;
export function writeReport(file: string, report: unknown): Promise<void>;
export function readReport(file: string): Promise<unknown>;
