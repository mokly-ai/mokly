import { fork } from "node:child_process";
import { once } from "node:events";
import type { EventEmitter } from "node:events";
import path from "node:path";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { Operation } from "../generated/sidecar/Operation.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { SidecarError, detail } from "./errors.js";
import { dependencyDirectory } from "./importer-resolution.js";
import { jsonText } from "./json.js";
import { ModulePaths } from "./module-paths.js";
import { PostcssProcess } from "./postcss-process.js";
import { sourceDependency } from "./source-dependencies.js";

/** Children retain one module instance until their explicit context is disposed. */
export class PostcssWorkers {
  private workers = new Map<string, PostcssProcess>();
  private contexts = new Map<string, string>();
  private id = 0;

  constructor(
    private readonly diagnostic: (message: string) => void,
    private readonly operation: (operation: Operation) => void = () => {},
    private readonly launch: typeof fork = fork,
  ) {}

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
      const child = this.launch(
        new URL("./postcss-worker.js", import.meta.url),
        [],
        {
          cwd: root,
          env: {
            ...process.env,
            PWD: root,
            INIT_CWD: undefined,
            npm_package_json: undefined,
            npm_config_local_prefix: undefined,
            NODE_PATH: [...paths.dependencyRoots, process.env.NODE_PATH]
              .filter(Boolean)
              .join(path.delimiter),
          },
          stdio: ["pipe", "pipe", "pipe", "ipc"],
        },
      );
      const closed = () => {
        if (this.workers.get(key) === worker) this.workers.delete(key);
      };
      worker = new PostcssProcess(child, closed);
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      observePostcssProcess(child, closed, this.operation);
      child.stdout?.on("data", (chunk) => this.diagnostic(String(chunk)));
      child.stderr?.on("data", (chunk) => this.diagnostic(String(chunk)));
      this.workers.set(key, worker);
      worker.send({
        postcss: file,
        sourceRoot: root,
        moduleResolution: params.moduleResolution,
        repositoryRoots: paths.repositoryRoots,
      });
    }
    const physical = stylesheetSource(paths, params.sourcePath);
    const sourcePath = (await sourceDependency(paths, physical)) ?? physical;
    return worker.request(++this.id, { ...params, sourcePath });
  }

  async dispose(context?: string): Promise<void> {
    const selected = [...this.workers].filter(
      ([key]) => context === undefined || JSON.parse(key)[0] === context,
    );
    for (const [key] of selected) this.workers.delete(key);
    if (context === undefined) this.contexts.clear();
    else this.contexts.delete(context);
    await Promise.all(
      selected.map(async ([, { child: worker }]) => {
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
  if (
    paths.dependencyRoot &&
    dependencyDirectory(
      paths.dependencyRoot,
      path.resolve(paths.dependencyRoot, source),
    )
  )
    return path.resolve(paths.dependencyRoot, source);
  return path.resolve(paths.sourceRoot, source);
}

/** Count a fork and its terminal event once, including errors without an exit. */
export function observePostcssProcess(
  child: EventEmitter,
  closed: () => void,
  operation: (operation: Operation) => void,
): void {
  operation("postcss-start");
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    closed();
    operation("postcss-stop");
  };
  child.once("exit", stop).once("error", stop);
}
