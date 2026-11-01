import type { runCaptured } from "./process.mjs";
import type { TypecheckOptions } from "./typecheck-runner.mjs";

/** The standard fallback command and the optional Bun probe and output adapters. */
export interface FastTypecheckOptions extends TypecheckOptions {
  probe?: typeof runCaptured;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
}

/** Select Bun or the unavailable-tool fallback, then check the shared projects. */
export function runFastTypecheck(
  options: FastTypecheckOptions,
): Promise<number>;
