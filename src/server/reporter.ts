import type { ManifestV5 } from "@mokly/viewer/data";

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
  catalogueReady(manifest: ManifestV5, durationMs: number): void;
  changesReady(changed: number, durationMs: number): void;
  changesUnavailable(durationMs: number): void;
  gitReferenceRefresh(base: string): void;
  runtimeDiagnostic(error: unknown): void;
  serveReady(report: ServeReadyReport): void;
  watchFailed(report: WatchReport, error: unknown): void;
  watchFinished(report: WatchReport): void;
  watchStarted(report: WatchReport): void;
}

/** Default server reporter: lifecycle events stay silent and errors keep old bytes. */
export class PlainServeReporter implements ServeReporter {
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
  catalogueReady(_manifest: ManifestV5, _durationMs: number): void {}
  changesReady(_changed: number, _durationMs: number): void {}
  changesUnavailable(_durationMs: number): void {}
  gitReferenceRefresh(_base: string): void {}
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
