import { MoklyError, type MoklyErrorOptions } from "../errors.js";

export type BaselineErrorCode =
  | "baseline-history-unavailable"
  | "baseline-extraction-failed"
  | "baseline-command-failed"
  | "baseline-output-invalid"
  | "baseline-interrupted"
  | "baseline-lock-timeout";

/** Stable failure reasons shared by preparation, CLI, and background evidence. */
export class BaselineError extends MoklyError {
  declare readonly code: BaselineErrorCode;
  constructor(
    code: BaselineErrorCode,
    message: string,
    cause?: unknown,
    options: Pick<MoklyErrorOptions, "cancelled"> = {},
  ) {
    super(code, message, {
      ...(cause === undefined ? {} : { cause }),
      ...(options.cancelled ? { cancelled: true } : {}),
    });
    this.name = "BaselineError";
  }
}

/** A failed argv command, retaining structured status and bounded diagnostics. */
export class BaselineCommandError extends BaselineError {
  constructor(
    readonly commandIndex: number,
    readonly argv: readonly string[],
    readonly exitCode: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly outputLines: readonly string[],
    cause?: unknown,
  ) {
    super(
      "baseline-command-failed",
      `Baseline command ${commandIndex} ${JSON.stringify(argv)} failed ` +
        `(${exitCode ?? signal ?? "could not start"})\n${outputLines.join("\n")}`,
      cause,
    );
  }
}

/** Cancellation has the same typed outcome at every preparation boundary. */
export function assertBaselineActive(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new BaselineError(
      "baseline-interrupted",
      "Baseline preparation was interrupted",
      signal.reason,
      { cancelled: true },
    );
}
