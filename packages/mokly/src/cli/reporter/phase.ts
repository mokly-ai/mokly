import type { CliReporter } from "./types.js";

/** Run one command boundary while settling its reporter phase on every path. */
export async function reportPhase<Result>(
  reporter: CliReporter,
  label: string,
  success: string,
  action: () => Promise<Result>,
): Promise<Result> {
  const phase = reporter.startPhase(label);
  try {
    const result = await action();
    phase.succeed(success);
    return result;
  } catch (error) {
    phase.fail();
    throw error;
  }
}
