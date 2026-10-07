import type { ManifestV9 } from "@mokly/viewer/data";

import { EARLIER_BASELINE_MESSAGE } from "../baseline/compatibility.js";
import { BaselineNoticeState } from "../baseline/notice_state.js";
import {
  formatBuildDiagnostic,
  type BuildDiagnostic,
} from "../build/build_warnings.js";
import type { Compilation } from "../build/compile.js";
import type { GeneratedOutputSummary } from "../build/output_summary.js";
import { errorMessage } from "../errors.js";

import type { RuntimeWatchAction } from "./watch_events.js";

/** Stable information available when Serve has bound its public URL. */
export interface ServeReadyReport {
  readonly base: string;
  readonly configPath: string;
  readonly url: string;
  readonly version: string;
  readonly watch: boolean;
}

/** One serialized watch action and the candidates that caused it. */
export interface WatchReport {
  readonly action: RuntimeWatchAction;
  readonly durationMs: number;
  readonly paths: readonly string[];
  readonly repoRoot: string;
}

/** Presentation boundary for Serve lifecycle, watch, and runtime diagnostics. */
export interface ServeReporter {
  outputWritten?(summary: GeneratedOutputSummary, durationMs: number): void;
  baselineAccepted(commit: string): void;
  baselineNotice(message: string): void;
  baselinePreparing(base: string): void;
  baselineReady(commit: string, cacheHit: boolean, durationMs: number): void;
  buildWarnings(diagnostics: readonly BuildDiagnostic[]): void;
  catalogueReady(manifest: ManifestV9, durationMs: number): void;
  changesReady(changed: number, durationMs: number): void;
  changesUnavailable(durationMs: number): void;
  gitReferenceRefresh(base: string): void;
  incompatibleBaseline(commit: string): void;
  runtimeDiagnostic(error: unknown): void;
  serveReady(report: ServeReadyReport): void;
  watchFailed(report: WatchReport, error: unknown): void;
  watchFinished(report: WatchReport): void;
  watchStarted(report: WatchReport): void;
}

/** Report one accepted generation's warnings immediately before its ready line. */
export function reportCatalogueReady(
  reporter: ServeReporter,
  compilation: Compilation,
  durationMs: number,
): void {
  reporter.buildWarnings(compilation.diagnostics);
  reporter.catalogueReady(compilation.manifest, durationMs);
}

/** Default server reporter: lifecycle events stay silent and errors keep old bytes. */
export class PlainServeReporter implements ServeReporter {
  private readonly baseline = new BaselineNoticeState();
  constructor(
    private readonly write: (value: string) => void = (value) =>
      process.stderr.write(value),
    private readonly writeNotice: (value: string) => void = (value) =>
      process.stdout.write(value),
  ) {}

  baselineAccepted(commit: string): void {
    this.baseline.accept(commit);
  }
  baselineNotice(message: string): void {
    this.writeNotice(`${message}\n`);
  }
  baselinePreparing(_base: string): void {}
  baselineReady(commit: string, _cacheHit: boolean, _durationMs: number): void {
    this.baselineAccepted(commit);
  }
  buildWarnings(diagnostics: readonly BuildDiagnostic[]): void {
    for (const diagnostic of diagnostics)
      this.write(`[mokly/warning] ${formatBuildDiagnostic(diagnostic)}\n`);
  }
  catalogueReady(_manifest: ManifestV9, _durationMs: number): void {}
  changesReady(_changed: number, _durationMs: number): void {}
  changesUnavailable(_durationMs: number): void {}
  gitReferenceRefresh(_base: string): void {}
  incompatibleBaseline(commit: string): void {
    if (this.baseline.take(commit))
      this.baselineNotice(EARLIER_BASELINE_MESSAGE);
  }
  runtimeDiagnostic(error: unknown): void {
    this.write(`${errorMessage(error)}\n`);
  }
  serveReady(_report: ServeReadyReport): void {}
  watchFailed(_report: WatchReport, error: unknown): void {
    this.runtimeDiagnostic(error);
  }
  watchFinished(_report: WatchReport): void {}
  watchStarted(_report: WatchReport): void {}
}
