export interface VerificationProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
}

export interface VerificationProcessOutcome {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  interrupted: NodeJS.Signals | "abort" | null;
}

export function runInherited(
  program: string,
  args: string[],
  options?: VerificationProcessOptions,
): Promise<VerificationProcessOutcome>;

export function runCaptured(
  program: string,
  args: string[],
  options?: VerificationProcessOptions,
): Promise<VerificationProcessOutcome & { stdout: string; stderr: string }>;
