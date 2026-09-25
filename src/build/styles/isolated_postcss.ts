/** A single worker and module registry per graph load, shared across its stylesheets. */
import { Worker } from "node:worker_threads";

import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError, type MoklyErrorCode } from "../../errors.js";

import type { ProcessedStyleText, StyleTextProcessor } from "./preprocess.js";

interface Response {
  readonly id: number;
  readonly result?: ProcessedStyleText;
  readonly error?: { readonly code: MoklyErrorCode; readonly message: string };
}

/** Run a graph load's PostCSS plugins in a fresh Node module context. */
export class IsolatedPostcssProcessor implements StyleTextProcessor {
  private readonly worker: Worker;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: ProcessedStyleText) => void;
      reject: (error: Error) => void;
    }
  >();
  private nextId = 1;
  private readonly ready: Promise<void>;

  constructor(config: ResolvedConfig) {
    this.worker = new Worker(new URL("./postcss_worker.js", import.meta.url), {
      workerData: config,
      execArgv: [],
    });
    this.ready = new Promise((resolve, reject) => {
      this.pending.set(0, { resolve: () => resolve(), reject });
    });
    this.worker.on("message", (message: Response) => {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        const prefix = `[mokly/${message.error.code}] `;
        pending.reject(
          new MoklyError(
            message.error.code,
            message.error.message.startsWith(prefix)
              ? message.error.message.slice(prefix.length)
              : message.error.message,
          ),
        );
      } else if (message.id === 0)
        pending.resolve({ css: "", sourceFiles: [] });
      else if (message.result) pending.resolve(message.result);
      else pending.reject(new Error("PostCSS worker returned no result"));
    });
    const failed = (error: Error): void => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
    this.worker.on("error", failed);
    this.worker.on("exit", (code) => {
      if (code !== 0)
        failed(new Error(`PostCSS worker exited with code ${code}`));
    });
  }

  /** Ensure plugin configuration is valid before building the graph. */
  async start(): Promise<void> {
    await this.ready;
  }

  /** Process one stylesheet without reinstantiating the worker's plugins. */
  async process(source: string, text: string): Promise<ProcessedStyleText> {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, source, text });
    });
  }

  /** Release all plugin state after this graph load, including failures. */
  async close(): Promise<void> {
    await this.worker.terminate();
  }
}
