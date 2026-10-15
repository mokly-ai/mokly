import path from "node:path";
import { Worker } from "node:worker_threads";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { SidecarError } from "./errors.js";
import { confinedFile } from "./paths.js";

/** Workers retain one module instance until their owning generation is disposed. */
export class PostcssWorkers {
  private workers = new Map<string, Worker>();
  private id = 0;

  constructor(private readonly diagnostic: (message: string) => void) {}

  async process(params: ProcessCssParams, root: string): Promise<CssResult> {
    const file = await confinedFile(root, params.postcss);
    if (!/\.(ts|mts|js|mjs|cjs)$/.test(file))
      throw new SidecarError(
        "bundle-failed",
        "postcss module has an unsupported suffix",
      );
    let worker = this.workers.get(file);
    if (!worker) {
      worker = new Worker(new URL("./postcss-worker.js", import.meta.url), {
        workerData: { postcss: file, sourceRoot: root },
        stdout: true,
        stderr: true,
      });
      worker.stdout.on("data", (chunk) => this.diagnostic(String(chunk)));
      worker.stderr.on("data", (chunk) => this.diagnostic(String(chunk)));
      worker.on("error", () => this.workers.delete(file));
      this.workers.set(file, worker);
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

  async dispose(): Promise<void> {
    await Promise.all(
      [...this.workers.values()].map((worker) => worker.terminate()),
    );
    this.workers.clear();
  }
}
