import type { ManifestV7 } from "@mokly/viewer/data";

import { EARLIER_BASELINE_MESSAGE } from "../../baseline/compatibility.js";
import {
  formatBuildDiagnostic,
  type BuildDiagnostic,
} from "../../build/build_warnings.js";
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
  readonly #incompatible = new Set<string>();

  constructor(readonly environment: TerminalEnvironment) {}

  close(): void {}

  clearServe(): void {}

  baselinePreparing(_base: string): void {}

  baselineReady(
    _commit: string,
    _cacheHit: boolean,
    _durationMs: number,
  ): void {}

  buildWarnings(diagnostics: readonly BuildDiagnostic[]): void {
    for (const diagnostic of diagnostics)
      this.environment.stderr.write(
        `[mokly/warning] ${formatBuildDiagnostic(diagnostic)}\n`,
      );
  }

  catalogueReady(_manifest: ManifestV7, _durationMs: number): void {}

  changesReady(_changed: number, _durationMs: number): void {}

  changesUnavailable(_durationMs: number): void {}

  diagnostic(message: string): void {
    this.environment.stderr.write(`${message}\n`);
  }

  gitReferenceRefresh(_base: string): void {}

  incompatibleBaseline(commit: string): void {
    if (this.#incompatible.has(commit)) return;
    this.#incompatible.add(commit);
    this.environment.stderr.write(`${EARLIER_BASELINE_MESSAGE}\n`);
  }

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
