/** A single worker and module registry per graph load, shared across its stylesheets. */
import path from "node:path";
import { Worker } from "node:worker_threads";

import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";

import type { ProcessedStyleText, StyleTextProcessor } from "./preprocess.js";
import { WorkerRequests } from "./worker_requests.js";

/** Run a graph load's PostCSS plugins in a fresh Node module context. */
export class IsolatedPostcssProcessor implements StyleTextProcessor {
  private readonly requests: WorkerRequests<ProcessedStyleText>;

  constructor(config: ResolvedConfig) {
    const worker = new Worker(new URL("./postcss_worker.js", import.meta.url), {
      workerData: config,
      execArgv: [],
    });
    const module = toPosixPath(
      path.relative(config.repoRoot, config.postcss ?? ""),
    );
    this.requests = new WorkerRequests(worker, module);
  }

  /** Ensure plugin configuration is valid before building the graph. */
  async start(): Promise<void> {
    await this.requests.start();
  }

  /** Process one stylesheet without reinstantiating the worker's plugins. */
  async process(source: string, text: string): Promise<ProcessedStyleText> {
    return this.requests.request({ source, text });
  }

  /** Release all plugin state after this graph load, including failures. */
  async close(): Promise<void> {
    await this.requests.close();
  }
}
