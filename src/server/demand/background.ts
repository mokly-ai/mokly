/** Bound background lifetime to one accepted source generation. */
import { MessageChannel, Worker } from "node:worker_threads";

import type { Compilation } from "../../build/compile.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import { timingArguments } from "../../diagnostics/timings.js";
import type { PreparedReviewRepository } from "../../review/prepare.js";
import type { ComponentChangeSnapshot } from "../component_changes.js";

import { BackgroundGitHost } from "./git_host.js";

export class BackgroundCompilation {
  private readonly worker: Worker;
  private readonly git: BackgroundGitHost;
  private readonly pause = new Int32Array(new SharedArrayBuffer(4));
  private closed = false;
  private closing: Promise<void> | undefined;
  readonly compilation: Promise<Compilation>;
  private rejectCompilation: (error: unknown) => void = () => {};
  private classification:
    | {
        resolve(value: ComponentChangeSnapshot | undefined): void;
        reject(error: unknown): void;
      }
    | undefined;
  constructor(runtime: ComponentRuntime, existing?: Compilation) {
    const { port1, port2 } = new MessageChannel();
    this.git = new BackgroundGitHost(runtime.config.repoRoot, port1);
    try {
      this.worker = new Worker(
        new URL("./background_worker.js", import.meta.url),
        {
          workerData: {
            runtime,
            pause: this.pause.buffer,
            debug: timingArguments().length > 0,
            gitPort: port2,
            ...(existing
              ? {
                  existingManifest: existing.manifest,
                  existingOutputs: existing.outputs,
                }
              : {}),
          },
          execArgv: [],
          transferList: [port2],
          resourceLimits: { maxOldGenerationSizeMb: 1024 },
        },
      );
    } catch (error) {
      port2.close();
      void this.git.close();
      throw error;
    }
    this.compilation = new Promise((resolve, reject) => {
      this.rejectCompilation = reject;
      if (existing) resolve(existing);
      this.worker.on(
        "message",
        (message: {
          type: string;
          compilation: Compilation;
          snapshot?: ComponentChangeSnapshot;
          error?: string;
        }) => {
          if (this.closed) return;
          if (message.type === "compiled") resolve(message.compilation);
          if (message.type === "classified") {
            this.classification?.resolve(message.snapshot);
            this.classification = undefined;
          }
          if (message.type === "failed") reject(new Error(message.error));
        },
      );
      this.worker.on("error", (error) => {
        void this.git.close();
        reject(error);
        this.classification?.reject(error);
      });
      this.worker.on("exit", () => {
        void this.git.close();
        reject(new Error("Background renderer stopped"));
        this.classification?.reject(new Error("Background renderer stopped"));
      });
    });
    void this.compilation.catch(() => {});
  }
  foreground(active: boolean): void {
    Atomics.store(this.pause, 0, Number(active));
  }
  classify(
    base: string,
    prepared?: Pick<
      PreparedReviewRepository,
      "commit" | "selection" | "descriptor"
    >,
  ): Promise<ComponentChangeSnapshot | undefined> {
    if (this.closed) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      this.classification = { resolve, reject };
      this.worker.postMessage({
        type: "classify",
        base,
        ...(prepared
          ? {
              commit: prepared.commit,
              selection: prepared.selection,
              descriptor: prepared.descriptor,
            }
          : {}),
      });
    });
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.rejectCompilation(new Error("Background generation replaced"));
    this.classification?.resolve(undefined);
    this.classification = undefined;
    this.closing = this.git.close().then(async () => {
      await this.worker.terminate();
    });
    return this.closing;
  }
}
