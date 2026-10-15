import path from "node:path";
import { Worker } from "node:worker_threads";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { SidecarError, detail } from "./errors.js";
import { confinedFile } from "./paths.js";

/** Workers retain one module instance until their explicit context is disposed. */
export class PostcssWorkers {
  private workers = new Map<string, Worker>();
  private contexts = new Map<string, string>();
  private id = 0;

  constructor(private readonly diagnostic: (message: string) => void) {}

  async process(params: ProcessCssParams): Promise<CssResult> {
    try {
      return await this.transform(params);
    } catch (error) {
      throw new SidecarError(
        "bundle-failed",
        `${params.postcss}: ${detail(error)}`,
      );
    }
  }

  private async transform(params: ProcessCssParams): Promise<CssResult> {
    const root = params.sourceRoot;
    const identity = JSON.stringify([root, params.moduleResolution]);
    const previous = this.contexts.get(params.context);
    if (previous !== undefined && previous !== identity)
      throw new Error(
        `PostCSS context ${params.context} changed its sources or resolution settings`,
      );
    this.contexts.set(params.context, identity);
    const file = await confinedFile(root, params.postcss);
    if (!/\.(ts|mts|js|mjs|cjs)$/.test(file))
      throw new SidecarError(
        "bundle-failed",
        "postcss module has an unsupported suffix",
      );
    const key = JSON.stringify([params.context, file]);
    let worker = this.workers.get(key);
    if (!worker) {
      worker = new Worker(new URL("./postcss-worker.js", import.meta.url), {
        workerData: {
          postcss: file,
          sourceRoot: root,
          moduleResolution: params.moduleResolution,
        },
        stdout: true,
        stderr: true,
      });
      worker.stdout.setEncoding("utf8");
      worker.stderr.setEncoding("utf8");
      worker.on("exit", () => this.workers.delete(key));
      worker.stdout.on("data", (chunk) => this.diagnostic(String(chunk)));
      worker.stderr.on("data", (chunk) => this.diagnostic(String(chunk)));
      worker.on("error", () => this.workers.delete(key));
      this.workers.set(key, worker);
    }
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      function cleanup() {
        worker!.off("message", receive);
        worker!.off("error", fail);
        worker!.off("exit", exit);
      }
      function fail(error: Error) {
        cleanup();
        reject(new SidecarError("bundle-failed", error.message));
      }
      function exit(code: number) {
        fail(new Error(`PostCSS worker exited with ${code}`));
      }
      function receive(message: {
        id: number;
        result?: CssResult;
        error?: string;
      }) {
        if (message.id !== id) return;
        cleanup();
        if (message.error)
          reject(new SidecarError("bundle-failed", message.error));
        else resolve(message.result!);
      }
      worker!.on("message", receive).once("error", fail).once("exit", exit);
      worker!.postMessage({
        id,
        params: {
          ...params,
          sourcePath: path.resolve(root, params.sourcePath),
        },
      });
    });
  }

  async dispose(context?: string): Promise<void> {
    const selected = [...this.workers].filter(
      ([key]) => context === undefined || JSON.parse(key)[0] === context,
    );
    for (const [key] of selected) this.workers.delete(key);
    if (context === undefined) this.contexts.clear();
    else this.contexts.delete(context);
    await Promise.all(selected.map(([, worker]) => worker.terminate()));
  }
}
