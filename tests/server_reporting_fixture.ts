import type { ManifestV9 } from "@mokly/viewer/data";

import type { BuildDiagnostic } from "../dist/build/build_warnings.js";
import type { ChildHandle } from "../dist/server/child_process.js";
import type { ServeReporter, WatchReport } from "../dist/server/reporter.js";
import type { ChildCommand } from "../dist/server/update_messages.js";
import { type DebounceClock } from "../dist/server/watch_events.js";

export class FakeClock implements DebounceClock {
  private callback: (() => void) | undefined;
  private readonly handle = {} as ReturnType<typeof setTimeout>;
  clear(_handle: ReturnType<typeof setTimeout>): void {
    this.callback = undefined;
  }
  schedule(
    callback: () => void,
    _milliseconds: number,
  ): ReturnType<typeof setTimeout> {
    this.callback = callback;
    return this.handle;
  }
  flush(): void {
    const callback = this.callback;
    this.callback = undefined;
    callback?.();
  }
}

export class RecordingReporter implements ServeReporter {
  readonly events: string[] = [];
  readonly complete: Promise<void>;
  private resolve: () => void = () => undefined;

  constructor() {
    this.complete = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  baselinePreparing(base: string): void {
    this.events.push(`baseline-preparing:${base}`);
  }
  baselineReady(commit: string, cacheHit: boolean): void {
    this.events.push(
      `baseline-ready:${commit}:${cacheHit ? "reused" : "rebuilt"}`,
    );
  }
  buildWarnings(diagnostics: readonly BuildDiagnostic[]): void {
    for (const diagnostic of diagnostics)
      this.events.push(`warning:${diagnostic.route}`);
  }
  catalogueReady(manifest: ManifestV9): void {
    const screens = manifest.entries.filter(
      (entry) => entry.kind === "screen",
    ).length;
    this.events.push(`catalogue:screen=${screens}`);
  }
  changesReady(changed: number): void {
    this.events.push(`changes-ready:${changed}`);
    this.resolve();
  }
  changesUnavailable(): void {
    this.events.push("changes-unavailable");
    this.resolve();
  }
  gitReferenceRefresh(_base: string): void {}
  incompatibleBaseline(_commit: string): void {}
  runtimeDiagnostic(error: unknown): void {
    this.events.push(
      `diagnostic:${error instanceof Error ? error.message : String(error)}`,
    );
  }
  serveReady(): void {}
  watchFailed(_report: WatchReport, _error: unknown): void {}
  watchFinished(report: WatchReport): void {
    this.events.push(`watch-finished:${report.action}`);
  }
  watchStarted(report: WatchReport): void {
    this.events.push(`watch-started:${report.action}`);
  }
}

export class ReportingChild implements ChildHandle {
  readonly listeners: Array<(value: unknown) => void> = [];
  readonly exits: Array<(code: number | null) => void> = [];
  forceKill(): void {}
  onDisconnect(): void {}
  onError(): void {}
  onExit(callback: (code: number | null) => void): void {
    this.exits.push(callback);
  }
  onMessage(callback: (value: unknown) => void): void {
    this.listeners.push(callback);
  }
  send(_message: ChildCommand): void {}
  terminate(): void {}
  emit(value: unknown): void {
    for (const listener of this.listeners) listener(value);
  }
  exit(): void {
    for (const listener of this.exits.splice(0)) listener(0);
  }
}
