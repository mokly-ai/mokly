import type { SpawnOptions } from "node:child_process";

/** Options accepted by an owned verification process. Output capture is fixed by its entrypoint. */
interface VerificationCommandOptions extends Omit<
  SpawnOptions,
  "cwd" | "env" | "stdio"
> {
  cwd?: string;
  env?: Readonly<Record<string, string | undefined>>;
}

/** Exit state after the command and its owned descendants have stopped. */
interface VerificationCommandOutcome {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  interrupted: NodeJS.Signals | null;
}

/** Run with inherited terminal output and owned process cleanup. */
export function runInherited(
  program: string,
  args: readonly string[],
  options?: VerificationCommandOptions,
): Promise<VerificationCommandOutcome>;

/** Run with captured text output and owned process cleanup. */
export function runCaptured(
  program: string,
  args: readonly string[],
  options?: VerificationCommandOptions,
): Promise<VerificationCommandOutcome & { stdout: string; stderr: string }>;
