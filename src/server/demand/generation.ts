/** Background output/evidence can be adopted only by its still-current source generation. */
import type {
  BaselineBuilder,
  BaselineProgress,
} from "../../baseline/types.js";
import type { Compilation } from "../../build/compile.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type { GeneratedOutputStore } from "../../build/output_store.js";
import type { ResolvedConfig } from "../../config/types.js";
import { timeAsync, timingCounts } from "../../diagnostics/timings.js";
import { acceptedGenerationFromCompilation } from "../../review/accepted_generation.js";
import {
  RepositoryCatalogueChangeClassifier,
  type CatalogueChangeClassifier,
  type ComponentChangeSnapshot,
} from "../component_changes.js";
import { PlainServeReporter } from "../reporter.js";
import type {
  PreparedResourceWatch,
  ResourceWatcher,
} from "../resource_watcher.js";

import { BackgroundCompilation } from "./background.js";
import { BackgroundBaseline } from "./baseline.js";

/** Collaborators and observers supplied by the Serve composition root. */
export interface BackgroundGenerationOptions {
  readonly resources?: ResourceWatcher;
  /** Resolves when the host shuts down; preparation stays independently cancellable. */
  readonly shutdown?: Promise<void>;
  /** The parent publishes or revokes the read capability for this generation. */
  readonly baselinePrepared?: (commit: string | null) => void;
  /**
   * Publish `preparing` while a derived baseline is genuinely rebuilt and
   * `pending` once it settles. Committed mode and a cache hit never call this.
   */
  readonly baselineStatus?: (status: "preparing" | "pending") => void;
  /** Observe cache-hit/rebuild identity without changing browser status. */
  readonly baselineProgress?: (event: BaselineProgress) => void;
  /** Route background failures through the process's sole terminal owner. */
  readonly diagnostic?: (error: unknown) => void;
  /** Injected by tests; the composition root builds the real one on demand. */
  readonly builder?: BaselineBuilder;
}

export class BackgroundGeneration {
  private worker: BackgroundCompilation | undefined;
  private adoption: Promise<void> = Promise.resolve();
  private sequence = 0;
  private closed = false;
  private busy = false;
  private readonly baseline: BackgroundBaseline;
  private controller: AbortController | undefined;
  private readonly shutdown: Promise<void>;
  constructor(
    private readonly store: GeneratedOutputStore,
    private readonly classifier: CatalogueChangeClassifier,
    private readonly completed: (
      compilation: Compilation,
      runtime: ComponentRuntime,
    ) => void,
    private readonly classified: (
      snapshot: ComponentChangeSnapshot | undefined,
    ) => void,
    private readonly options: BackgroundGenerationOptions = {},
  ) {
    this.shutdown = options.shutdown ?? new Promise(() => {});
    this.baseline = new BackgroundBaseline(
      options.baselineStatus,
      options.baselinePrepared,
      options.builder,
      options.baselineProgress,
      options.diagnostic
        ? (message) => options.diagnostic?.(message)
        : undefined,
    );
  }

  start(runtime: ComponentRuntime, base: string, existing?: Compilation): void {
    if (this.closed) return;
    const sequence = ++this.sequence;
    const controller = (this.controller = new AbortController());
    const worker = (this.worker = new BackgroundCompilation(runtime, existing));
    worker.foreground(this.busy);
    const current = () => !this.closed && sequence === this.sequence;
    this.adoption = (async () => {
      let prepared: PreparedResourceWatch | undefined;
      try {
        const compilation = await worker.compilation;
        if (!current()) return;
        prepared = await this.options.resources?.prepare(
          runtime.config,
          compilation,
          this.shutdown,
          existing !== undefined,
        );
        if (!current()) return;
        if (!existing) await this.store.write(compilation, runtime.config);
        if (!current()) return;
        prepared?.adopt();
        this.completed(compilation, runtime);
        const baseline =
          runtime.config.generatedOutput === "derived" &&
          this.classifier instanceof RepositoryCatalogueChangeClassifier
            ? await this.baseline.prepare(
                runtime.config,
                base,
                controller.signal,
              )
            : undefined;
        if (!current()) return;
        if (baseline) this.options.baselinePrepared?.(baseline.commit);
        const snapshot = await timeAsync("changes.classify", () =>
          this.classifier instanceof RepositoryCatalogueChangeClassifier
            ? worker.classify(base, baseline?.commit)
            : Promise.race([
                this.classifier.read(
                  runtime.config,
                  compilation.manifest,
                  base,
                  controller.signal,
                  {
                    generation: acceptedGenerationFromCompilation(compilation),
                  },
                ),
                new Promise<undefined>((resolve) =>
                  controller.signal.addEventListener(
                    "abort",
                    () => resolve(undefined),
                    { once: true },
                  ),
                ),
              ]),
        );
        if (current()) {
          if (snapshot)
            timingCounts("changes.publish", () => ({
              changedRoutes: snapshot.changedRoutes?.length ?? 0,
            }));
          this.classified(snapshot);
        }
      } catch (error) {
        if (current()) {
          if (this.options.diagnostic) this.options.diagnostic(error);
          else new PlainServeReporter().runtimeDiagnostic(error);
          this.classified(undefined);
        }
      } finally {
        await prepared?.close();
      }
    })();
  }

  get changesStatus(): "preparing" | "pending" {
    return this.baseline.status;
  }

  foreground(active: boolean): void {
    this.busy = active;
    this.worker?.foreground(active);
  }
  async invalidate(config?: ResolvedConfig): Promise<void> {
    this.sequence++;
    this.controller?.abort();
    this.controller = undefined;
    if (config) await this.baseline.reconfigure(config);
    const worker = this.worker;
    this.worker = undefined;
    await worker?.close();
    await this.adoption;
  }
  async close(): Promise<void> {
    this.closed = true;
    this.controller?.abort();
    await this.baseline.close();
    await this.invalidate();
  }
}
