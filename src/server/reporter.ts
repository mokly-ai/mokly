import type { ManifestV10 } from "@mokly/viewer/data";

import { EARLIER_BASELINE_MESSAGE } from "../baseline/compatibility.js";
import {
  formatBuildDiagnostic,
  type BuildDiagnostic,
} from "../build/build_warnings.js";
import type { Compilation } from "../build/compile.js";
import type { BuildWarningSink } from "../build/warning_sink.js";
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
  outputWritten?(count: number, directory: string, durationMs: number): void;
  baselinePreparing(base: string): void;
  baselineReady(commit: string, cacheHit: boolean, durationMs: number): void;
  buildWarnings(diagnostics: readonly BuildDiagnostic[]): void;
  catalogueReady(manifest: ManifestV10, durationMs: number): void;
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
  warnings?: BuildWarningSink,
  generation = warnings?.generation,
): void {
  if (warnings && generation !== warnings.generation) return;
  if (warnings) warnings.complete(compilation.diagnostics);
  else reporter.buildWarnings(compilation.diagnostics);
  reporter.catalogueReady(compilation.manifest, durationMs);
}

/** Default server reporter: lifecycle events stay silent and errors keep old bytes. */
export class PlainServeReporter implements ServeReporter {
  private readonly incompatible = new Set<string>();
  constructor(
    private readonly write: (value: string) => void = (value) =>
      process.stderr.write(value),
  ) {}

  baselinePreparing(_base: string): void {}
  baselineReady(
    _commit: string,
    _cacheHit: boolean,
    _durationMs: number,
  ): void {}
  buildWarnings(diagnostics: readonly BuildDiagnostic[]): void {
    for (const diagnostic of diagnostics)
      this.write(`[mokly/warning] ${formatBuildDiagnostic(diagnostic)}\n`);
  }
  catalogueReady(_manifest: ManifestV10, _durationMs: number): void {}
  changesReady(_changed: number, _durationMs: number): void {}
  changesUnavailable(_durationMs: number): void {}
  gitReferenceRefresh(_base: string): void {}
  incompatibleBaseline(commit: string): void {
    if (this.incompatible.has(commit)) return;
    this.incompatible.add(commit);
    this.write(`${EARLIER_BASELINE_MESSAGE}\n`);
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
