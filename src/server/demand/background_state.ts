/** Retain only the worker's classification inputs after complete parent delivery. */
import type { ManifestV7 } from "@mokly/viewer/data";

import type { Compilation } from "../../build/compile.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type { ResolvedConfig } from "../../config/types.js";
import { errorMessage } from "../../errors.js";
import type { CatalogueChangeClassification } from "../classification_result.js";
import type { CatalogueClassificationInputs } from "../component_changes.js";

import {
  classificationOutputs,
  type backgroundInputs,
} from "./background_inputs.js";

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
    manifest: ManifestV7,
    base: string,
    accepted: CatalogueClassificationInputs,
  ): Promise<CatalogueChangeClassification>;
}

export class BackgroundWorkerState {
  private readonly runtime: ComponentRuntime;
  private manifest: ManifestV7 | undefined;
  private outputs: ReadonlyMap<string, string> | undefined;

  constructor(
    inputs: ReturnType<typeof backgroundInputs>,
    private readonly checkpoint: () => Promise<void>,
    private readonly functions: BackgroundFunctions,
  ) {
    this.runtime = inputs.runtime;
    this.manifest = inputs.existingManifest;
    this.outputs = classificationOutputs(
      this.runtime.config,
      inputs.existingOutputs,
    );
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
      this.outputs = classificationOutputs(
        this.runtime.config,
        compilation.outputs,
      );
    } catch (error) {
      this.functions.post({ type: "failed", error: errorMessage(error) });
    }
  }

  async classify(message: { base: string; commit?: string }): Promise<void> {
    if (!this.manifest) return;
    if (this.runtime.config.generatedOutput === "derived" && !message.commit) {
      this.functions.post({ type: "classified" });
      return;
    }
    await this.checkpoint();
    const snapshot = await this.functions.classify(
      this.runtime.config,
      this.manifest,
      message.base,
      {
        ...(message.commit ? { commit: message.commit } : {}),
        ...(this.outputs ? { outputs: this.outputs } : {}),
      },
    );
    this.functions.post({ type: "classified", snapshot });
  }
}
