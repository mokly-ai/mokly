import type { BunPinOptions } from "./bun-pin.mjs";
import type { runCaptured } from "./process.mjs";
import type { TypecheckOptions } from "./typecheck-runner.mjs";

/** The shared compiler settings, pin reader, Bun probe, and output adapters. */
export interface RequiredTypecheckOptions
  extends TypecheckOptions, BunPinOptions {
  probe?: typeof runCaptured;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
}

/** Require the exact pinned Bun, then check the shared projects without fallback. */
export function runRequiredTypecheck(
  options: RequiredTypecheckOptions,
): Promise<number>;
