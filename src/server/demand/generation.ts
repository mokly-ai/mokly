/** Background output/evidence can be adopted only by its still-current source generation. */
import { isIncompatibleEarlierBaseline } from "../../baseline/compatibility.js";
import type {
  BaselineBuilder,
  BaselineProgress,
} from "../../baseline/types.js";
import type { Compilation } from "../../build/compile.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type { GeneratedFile } from "../../build/generated_file.js";
import type { GeneratedOutputStore } from "../../build/output_store.js";
import type { ResolvedConfig } from "../../config/types.js";
import { timeAsync, timingCounts } from "../../diagnostics/timings.js";
import { MANIFEST_NAME } from "../../registry/manifest.js";
import { acceptedGenerationFromCompilation } from "../../review/accepted_generation.js";
import type { PreparedReviewRepository } from "../../review/prepare.js";
import {
  isEarlierBaselineClassification,
  isInvalidBaselineClassification,
} from "../classification_result.js";
import type {
  CatalogueChangeClassifier,
  ComponentChangeSnapshot,
} from "../component_change_types.js";
import { RepositoryCatalogueChangeClassifier } from "../component_changes.js";
import { PlainServeReporter } from "../reporter.js";
import { refreshResourceCompilation } from "../resource_compilation.js";
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
  readonly baselinePrepared?: (
    prepared: Pick<
      PreparedReviewRepository,
      "commit" | "selection" | "descriptor"
    > | null,
  ) => void;
  /**
   * Publish `preparing` only while a baseline is genuinely rebuilt.
   */
  readonly baselineStatus?: (status: "preparing" | "pending") => void;
  /** Observe cache-hit/rebuild identity without changing browser status. */
  readonly baselineProgress?: (event: BaselineProgress) => void;
  /** Route background failures through the process's sole terminal owner. */
  readonly diagnostic?: (error: unknown) => void;
  readonly baselineNotice?: (message: string) => void;
  readonly baselineAccepted?: (commit: string) => void;
  /** Report the expected earlier-version outcome once per baseline commit. */
  readonly incompatibleBaseline?: (commit: string) => void;
  /** Injected by tests; the composition root builds the real one on demand. */
  readonly builder?: BaselineBuilder;
  readonly writeOutput?: boolean;
  readonly outputWritten?: (
    compilation: Compilation,
    durationMs: number,
  ) => void;
}

export class BackgroundGeneration {
  private worker: BackgroundCompilation | undefined;
  private written:
    { directory: string; manifest: GeneratedFile | undefined } | undefined;
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
      options.baselineNotice,
    );
  }

  start(
    runtime: ComponentRuntime,
    base: string,
    existing?: Compilation,
    refreshOutput = false,
  ): void {
    if (this.closed) return;
    const sequence = ++this.sequence;
    const controller = (this.controller = new AbortController());
    let worker = (this.worker = new BackgroundCompilation(runtime, existing));
    worker.foreground(this.busy);
    const current = () => !this.closed && sequence === this.sequence;
    this.adoption = (async () => {
      let prepared: PreparedResourceWatch | undefined;
      try {
        let compilation = await worker.compilation;
        if (!current()) return;
        prepared = await this.options.resources?.prepare(
          runtime.config,
          compilation,
          this.shutdown,
          existing !== undefined,
        );
        if (!current()) return;
        const refreshed = refreshResourceCompilation(compilation, prepared);
        if (refreshed !== compilation) {
          compilation = refreshed;
          await worker.close();
          if (!current()) return;
          worker = this.worker = new BackgroundCompilation(
            runtime,
            compilation,
          );
          worker.foreground(this.busy);
        }
        const written = {
          directory: runtime.config.generatedDir,
          manifest: compilation.outputs.get(MANIFEST_NAME),
        };
        const changed =
          written.directory !== this.written?.directory ||
          written.manifest !== this.written?.manifest;
        if (
          (!existing || (refreshOutput && changed)) &&
          this.options.writeOutput
        ) {
          const started = Date.now();
          await this.store.write(
            compilation,
            runtime.config,
            controller.signal,
          );
          this.written = written;
          this.options.outputWritten?.(compilation, Date.now() - started);
        }
        if (!current()) return;
        prepared?.adopt();
        this.completed(compilation, runtime);
        const baseline =
          this.classifier instanceof RepositoryCatalogueChangeClassifier
            ? await this.baseline.prepare(
                runtime.config,
                base,
                controller.signal,
              )
            : undefined;
        if (!current()) return;
        if (baseline) {
          this.options.baselineAccepted?.(baseline.commit);
          this.options.baselinePrepared?.(baseline);
        }
        const classification = await timeAsync("changes.classify", () =>
          this.classifier instanceof RepositoryCatalogueChangeClassifier
            ? worker.classify(base, baseline)
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
          const snapshot =
            isEarlierBaselineClassification(classification) ||
            isInvalidBaselineClassification(classification)
              ? undefined
              : classification;
          if (isEarlierBaselineClassification(classification))
            this.options.incompatibleBaseline?.(classification.commit);
          if (isInvalidBaselineClassification(classification))
            this.options.diagnostic?.(new Error(classification.diagnostic));
          if (snapshot)
            timingCounts("changes.publish", () => ({
              changedEntries: snapshot.changedEntries?.length ?? 0,
            }));
          for (const diagnostic of snapshot?.pairing?.diagnostics ?? []) {
            if (this.options.diagnostic) this.options.diagnostic(diagnostic);
            else new PlainServeReporter().runtimeDiagnostic(diagnostic);
          }
          this.classified(snapshot);
        }
      } catch (error) {
        if (current()) {
          if (isIncompatibleEarlierBaseline(error))
            this.options.incompatibleBaseline?.(this.baseline.commit ?? base);
          else if (this.options.diagnostic) this.options.diagnostic(error);
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
