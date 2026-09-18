export interface VerificationShard {
  index: number;
  total: number;
}

export interface VerificationIdentity {
  commit: string;
  runtime: string;
  nodeVersion: string;
}

export function parseShardArgument(
  args: readonly string[],
): VerificationShard | undefined;

export function discoverUnitFiles(repositoryRoot: string): Promise<string[]>;

export function nodeShardFiles(
  files: readonly string[],
  shard: VerificationShard | undefined,
): string[];

export function verificationIdentity(
  repositoryRoot: string,
): Promise<VerificationIdentity>;

export function defaultReportPath(
  repositoryRoot: string,
  suite: "unit" | "browser",
  shard: VerificationShard | undefined,
): string;

export function writeReport(file: string, report: unknown): Promise<void>;

export function readReport(file: string): Promise<unknown>;
