import type { BuildWarning } from "../../build/warnings.js";
import type { ServeReporter } from "../../server/reporter.js";
import type { BrowserOpener } from "../browser.js";

/** Writable terminal boundary used by real streams and deterministic tests. */
export interface CliOutput {
  readonly columns: number | undefined;
  readonly isTTY: boolean | undefined;
  write(chunk: string): unknown;
}

/** Readable terminal boundary needed by interactive Serve shortcuts. */
export interface CliInput {
  readonly isTTY?: boolean;
  readonly readableEnded?: boolean;
  readonly isRaw?: boolean;
  off(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  pause(): unknown;
  resume(): unknown;
  setRawMode?(value: boolean): unknown;
}

/** Injectable process-facing terminal state for one CLI invocation. */
export interface TerminalEnvironment {
  readonly browserOpener: BrowserOpener;
  readonly env: NodeJS.ProcessEnv;
  readonly now: () => number;
  readonly platform: NodeJS.Platform;
  readonly stderr: CliOutput;
  readonly stdin: CliInput;
  readonly stdout: CliOutput;
}

/** Selected output behavior for one complete invocation. */
export type OutputMode = "plain" | "rich";

/** Handle for the reporter's one currently active phase. */
export interface ReporterPhase {
  fail(): void;
  succeed(message: string): void;
}

/** Output seam shared by command composition and terminal tests. */
export interface CliReporter extends ServeReporter {
  buildWarning(warning: BuildWarning): void;
  readonly environment: TerminalEnvironment;
  readonly mode: OutputMode;
  clearServe(): void;
  close(): void;
  diagnostic(message: string): void;
  renderError(error: unknown, redact: (value: string) => string): void;
  startPhase(label: string): ReporterPhase;
  showShortcuts(): void;
  summary(plain: string, rich: string, durationMs: number): void;
  warning(message: string): void;
  write(value: string): void;
}
