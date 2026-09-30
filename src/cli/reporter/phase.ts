import { terminalWidth, truncateTerminalLine } from "./terminal.js";
import type { CliReporter, TerminalEnvironment } from "./types.js";

/** Mutable rich-reporter state for one active terminal phase. */
export interface ActivePhase {
  readonly startedAt: number;
  frame: number;
  readonly label: string;
  readonly timer?: ReturnType<typeof setInterval>;
}

/** Render one active phase frame through the reporter's terminal environment. */
export function renderPhase(
  active: ActivePhase,
  spinner: readonly string[],
  environment: TerminalEnvironment,
  newline: boolean,
): void {
  const glyph = spinner[active.frame % spinner.length];
  const value = truncateTerminalLine(
    `  ${glyph} ${active.label}…`,
    terminalWidth(environment.stdout, environment.env),
  );
  environment.stdout.write(newline ? `${value}\n` : `\r${value}`);
}

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
