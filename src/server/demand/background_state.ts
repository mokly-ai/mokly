/** Retain only the worker's classification inputs after complete parent delivery. */
import type { ManifestV9 } from "@mokly/viewer/data";

import type { BaselineCatalogue } from "../../baseline/catalogue.js";
import type { Compilation } from "../../build/compile.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type { GeneratedFile } from "../../build/generated_file.js";
import type { ResolvedConfig } from "../../config/types.js";
import { errorMessage } from "../../errors.js";
import type { BaselineSelection } from "../../review/repository.js";
import type { CatalogueChangeClassification } from "../classification_result.js";
import type { CatalogueClassificationInputs } from "../component_change_types.js";

import type { backgroundInputs } from "./background_inputs.js";

export type BackgroundWorkerMessage =
  | { type: "compiled"; compilation: Compilation }
  | { type: "failed"; error: string }
  | { type: "classified"; snapshot?: CatalogueChangeClassification };

interface BackgroundFunctions {
  compile(
    runtime: ComponentRuntime,
    checkpoint: () => Promise<void>,
  ): Promise<Compilation>;
  post(message: BackgroundWorkerMessage): void;
  classify(
    config: ResolvedConfig,
    manifest: ManifestV9,
    base: string,
    accepted: CatalogueClassificationInputs,
  ): Promise<CatalogueChangeClassification>;
}

export class BackgroundWorkerState {
  private readonly runtime: ComponentRuntime;
  private manifest: ManifestV9 | undefined;
  private outputs: ReadonlyMap<string, GeneratedFile> | undefined;

  constructor(
    inputs: ReturnType<typeof backgroundInputs>,
    private readonly checkpoint: () => Promise<void>,
    private readonly functions: BackgroundFunctions,
  ) {
    this.runtime = inputs.runtime;
    this.manifest = inputs.existingManifest;
    this.outputs = inputs.existingOutputs;
    delete inputs.existingOutputs;
  }

  get ready(): boolean {
    return this.manifest !== undefined;
  }

  async start(): Promise<void> {
    if (this.manifest) return;
    try {
      const compilation = await this.functions.compile(
        this.runtime,
        this.checkpoint,
      );
      this.manifest = compilation.manifest;
      this.functions.post({ type: "compiled", compilation });
      this.outputs = compilation.outputs;
    } catch (error) {
      this.functions.post({ type: "failed", error: errorMessage(error) });
    }
  }

  async classify(message: {
    base: string;
    commit?: string;
    selection?: BaselineSelection;
    descriptor?: BaselineCatalogue;
  }): Promise<void> {
    if (!this.manifest) return;
    if (!message.commit || !message.selection) {
      this.functions.post({ type: "classified" });
      return;
    }
    await this.checkpoint();
    const snapshot = await this.functions.classify(
      this.runtime.config,
      this.manifest,
      message.base,
      {
        commit: message.commit,
        selection: message.selection,
        ...(message.descriptor ? { descriptor: message.descriptor } : {}),
        generation: {
          routes: this.runtime.styleOutputs.map(([route]) => route),
          ...(this.outputs ? { outputs: this.outputs } : {}),
          deliveredStyleSources: this.runtime.deliveredStyleSources,
          documentMarkdown: new Map(
            (this.runtime.bundle.documents ?? []).map((entry) => [
              entry.sourceRelativePath,
              entry.markdown,
            ]),
          ),
        },
      },
    );
    this.functions.post({ type: "classified", snapshot });
  }
}
