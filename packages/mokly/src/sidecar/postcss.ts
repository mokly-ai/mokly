import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { PostcssFailure } from "../generated/sidecar/PostcssFailure.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { SidecarError, detail } from "./errors.js";
import { jsonText } from "./json.js";
import { ModulePaths } from "./module-paths.js";

/** Workers retain one module instance until their explicit context is disposed. */
export class PostcssWorkers {
  private workers = new Map<string, ChildProcess>();
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
        error instanceof SidecarError
          ? error.postcss
          : { kind: "load", module: params.postcss, detail: detail(error) },
      );
    }
  }

  private async transform(params: ProcessCssParams): Promise<CssResult> {
    const paths = await ModulePaths.create(params);
    const root = paths.sourceRoot;
    const identity = jsonText([
      root,
      paths.repositoryRoots,
      paths.dependencyRoots,
      params.moduleResolution,
    ]);
    const previous = this.contexts.get(params.context);
    if (previous !== undefined && previous !== identity)
      throw new Error(
        `PostCSS context ${params.context} changed its sources or resolution settings`,
      );
    this.contexts.set(params.context, identity);
    const file = await paths.resolve(path.resolve(root, params.postcss));
    if (!/\.(ts|mts|js|mjs|cjs)$/.test(file))
      throw new SidecarError(
        "bundle-failed",
        "postcss module has an unsupported suffix",
      );
    const key = JSON.stringify([params.context, file]);
    let worker = this.workers.get(key);
    if (!worker) {
      worker = fork(new URL("./postcss-worker.js", import.meta.url), [], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
      worker.stdout?.setEncoding("utf8");
      worker.stderr?.setEncoding("utf8");
      worker.on("exit", () => {
        if (this.workers.get(key) === worker) this.workers.delete(key);
      });
      worker.stdout?.on("data", (chunk) => this.diagnostic(String(chunk)));
      worker.stderr?.on("data", (chunk) => this.diagnostic(String(chunk)));
      worker.on("error", () => this.workers.delete(key));
      this.workers.set(key, worker);
      worker.send({
        postcss: file,
        sourceRoot: root,
        moduleResolution: params.moduleResolution,
        repositoryRoots: paths.repositoryRoots,
      });
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
      function exit(code: number | null) {
        fail(new Error(`PostCSS worker exited with ${code}`));
      }
      function receive(message: {
        id: number;
        result?: CssResult;
        error?: string;
        postcss?: PostcssFailure;
      }) {
        if (message.id !== id) return;
        cleanup();
        if (message.error)
          reject(
            new SidecarError("bundle-failed", message.error, message.postcss),
          );
        else resolve(message.result!);
      }
      worker!.on("message", receive).once("error", fail).once("exit", exit);
      worker!.send({
        id,
        params: {
          ...params,
          sourcePath: stylesheetSource(paths, params.sourcePath),
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
    await Promise.all(
      selected.map(async ([, worker]) => {
        if (worker.exitCode !== null || worker.signalCode !== null) return;
        const exited = once(worker, "exit");
        worker.kill("SIGKILL");
        await exited;
      }),
    );
  }
}

function stylesheetSource(paths: ModulePaths, source: string): string {
  const dependency = /^node_modules\/(?:\.mokly-roots\/(\d+)\/)?(.*)$/.exec(
    source,
  );
  if (dependency) {
    const root = paths.dependencyRoots[Number(dependency[1] ?? 0)];
    if (root) return path.resolve(root, dependency[2]!);
  }
  return path.resolve(paths.sourceRoot, source);
}
