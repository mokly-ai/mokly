import type { BaselineBuilder, BaselineProgress } from "../baseline/types.js";
import type { Compilation } from "../build/compile.js";
import type { ComponentRuntime } from "../build/component_runtime.js";
import type { GeneratedOutputStore } from "../build/output_store.js";
import type { BuildWarningSink } from "../build/warning_sink.js";
import type { ResolvedConfig } from "../config/types.js";

import type { CatalogueChangeClassifier } from "./component_changes.js";
import { BackgroundGeneration } from "./demand/generation.js";
import type { ServeReporter } from "./reporter.js";
import type { ResourceWatcher } from "./resource_watcher.js";
import type { ProcessSupervisor } from "./supervisor.js";

interface WatchedBackgroundOptions {
  readonly baselineBuilder?: BaselineBuilder;
  readonly base?: string;
  readonly classifier: CatalogueChangeClassifier;
  readonly config: () => ResolvedConfig;
  readonly outputStore: GeneratedOutputStore;
  readonly report: (error: unknown) => void;
  readonly reporter: ServeReporter;
  readonly warnings: BuildWarningSink;
  readonly resources: ResourceWatcher;
  readonly running: ProcessSupervisor;
  readonly runtime: () => ComponentRuntime;
  readonly shutdown: Promise<void>;
}

/** Own background compilation, evidence reporting, and accepted output state. */
export class WatchedBackground {
  private readonly generation: BackgroundGeneration;
  private activeCompilation: Compilation | undefined;
  private generationStartedAt = Date.now();
  private changesStartedAt = this.generationStartedAt;
  private baselineStartedAt = this.generationStartedAt;
  private reportCatalogue = true;

  constructor(private readonly options: WatchedBackgroundOptions) {
    this.generation = new BackgroundGeneration(
      options.outputStore,
      options.classifier,
      (compilation, accepted) => {
        compilation.warnings?.forEach((warning) =>
          options.warnings.add(warning),
        );
        this.changesStartedAt = Date.now();
        if (this.reportCatalogue)
          options.reporter.catalogueReady(
            compilation.manifest,
            this.changesStartedAt - this.generationStartedAt,
          );
        this.activeCompilation = compilation;
        options.running.completeCatalogue?.(
          compilation.manifest,
          accepted.generation,
        );
      },
      (snapshot) => {
        const duration = Date.now() - this.changesStartedAt;
        if (snapshot)
          options.reporter.changesReady(
            snapshot.changedRoutes?.length ?? 0,
            duration,
          );
        else options.reporter.changesUnavailable(duration);
        options.running.notifyUpdate(
          snapshot?.changedRoutes,
          snapshot,
          snapshot ? "ready" : "unavailable",
          "evidence",
        );
      },
      {
        onWarning: (warning) => options.warnings.add(warning),
        baselinePrepared: (commit) =>
          options.running.notifyUpdate(
            undefined,
            undefined,
            "pending",
            "evidence",
            commit,
          ),
        baselineStatus: (changesStatus) =>
          options.running.notifyUpdate(
            undefined,
            undefined,
            changesStatus,
            "evidence",
          ),
        baselineProgress: (event) => this.reportBaseline(event),
        diagnostic: options.report,
        resources: options.resources,
        shutdown: options.shutdown,
        ...(options.baselineBuilder
          ? { builder: options.baselineBuilder }
          : {}),
      },
    );
  }

  get compilation(): Compilation | undefined {
    return this.activeCompilation;
  }

  get changesStatus(): "preparing" | "pending" {
    return this.generation.changesStatus;
  }

  clearCompilation(): void {
    this.activeCompilation = undefined;
  }

  foreground(active: boolean): void {
    this.generation.foreground(active);
  }

  invalidate(config?: ResolvedConfig): Promise<void> {
    return this.generation.invalidate(config);
  }

  schedule(existing?: Compilation): void {
    this.generationStartedAt = Date.now();
    this.changesStartedAt = this.generationStartedAt;
    this.reportCatalogue = existing === undefined;
    const config = this.options.config();
    this.generation.start(
      this.options.runtime(),
      this.options.base ?? config.review.base,
      existing,
    );
  }

  close(): Promise<void> {
    return this.generation.close();
  }

  private reportBaseline(event: BaselineProgress): void {
    if (event.type === "start") {
      this.baselineStartedAt = Date.now();
      const config = this.options.config();
      this.options.reporter.baselinePreparing(
        this.options.base ?? config.review.base,
      );
    }
    if (event.type === "complete")
      this.options.reporter.baselineReady(
        event.commit,
        event.cacheHit,
        Date.now() - this.baselineStartedAt,
      );
  }
}
