import type { ManifestV6 } from "@mokly/viewer/data";

import type { BuildWarning } from "../../build/warnings.js";
import { errorMessage } from "../../errors.js";
import type { ServeReadyReport, WatchReport } from "../../server/reporter.js";

import type {
  CliReporter,
  ReporterPhase,
  TerminalEnvironment,
} from "./types.js";

const INACTIVE_PHASE: ReporterPhase = {
  fail: () => undefined,
  succeed: () => undefined,
};

/** Compatibility reporter whose bytes match the historical CLI output. */
export class PlainReporter implements CliReporter {
  readonly mode = "plain" as const;

  constructor(readonly environment: TerminalEnvironment) {}

  close(): void {}

  clearServe(): void {}

  baselinePreparing(_base: string): void {}

  baselineReady(
    _commit: string,
    _cacheHit: boolean,
    _durationMs: number,
  ): void {}

  catalogueReady(_manifest: ManifestV6, _durationMs: number): void {}

  changesReady(_changed: number, _durationMs: number): void {}

  changesUnavailable(_durationMs: number): void {}
  buildWarning(warning: BuildWarning): void {
    this.environment.stderr.write(`[mokly/warning] ${warning.message}\n`);
  }

  diagnostic(message: string): void {
    this.environment.stderr.write(`${message}\n`);
  }

  gitReferenceRefresh(_base: string): void {}

  renderError(error: unknown, redact: (value: string) => string): void {
    this.environment.stderr.write(`${redact(errorMessage(error))}\n`);
  }

  runtimeDiagnostic(error: unknown): void {
    this.environment.stderr.write(`${errorMessage(error)}\n`);
  }

  serveReady(report: ServeReadyReport): void {
    this.write(
      `Mokly listening at ${report.url}${report.watch ? " (watching)" : ""}\n`,
    );
  }

  startPhase(_label: string): ReporterPhase {
    return INACTIVE_PHASE;
  }

  showShortcuts(): void {}

  summary(plain: string, _rich: string, _durationMs: number): void {
    this.write(plain);
  }

  warning(message: string): void {
    this.environment.stderr.write(`${message}\n`);
  }

  watchFailed(_report: WatchReport, error: unknown): void {
    this.runtimeDiagnostic(error);
  }

  watchFinished(_report: WatchReport): void {}

  watchStarted(_report: WatchReport): void {}

  write(value: string): void {
    this.environment.stdout.write(value);
  }
}
