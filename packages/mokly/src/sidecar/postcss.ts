import { fork } from "node:child_process";
import type { ChildProcess, ForkOptions } from "node:child_process";
import { once } from "node:events";
import type { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { Operation } from "../generated/sidecar/Operation.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { SidecarError, detail } from "./errors.js";
import { dependencyDirectory } from "./importer-resolution.js";
import { ModulePaths } from "./module-paths.js";
import { PostcssProcess } from "./postcss-process.js";
import { sourceDependency } from "./source-dependencies.js";

type ContextParams = Omit<ProcessCssParams, "sourcePath" | "text">;
type Launch = (
  file: URL,
  args: readonly string[],
  options: ForkOptions,
) => ChildProcess;
interface Started {
  paths: ModulePaths;
  file: string;
  worker: PostcssProcess;
}

/** Children retain one module instance until their explicit context is disposed. */
export class PostcssWorkers {
  private workers = new Map<string, PostcssProcess>();
  private preparations = new Map<string, Promise<Started>>();
  private starting = new Map<string, Set<{ active: boolean }>>();
  private stopped = false;
  private used = new WeakSet<PostcssProcess>();
  private id = 0;

  constructor(
    private readonly diagnostic: (message: string) => void,
    private readonly operation: (operation: Operation) => void = () => {},
    private readonly launch: Launch = fork,
    private readonly phase: (line: string) => void = () => {},
  ) {}

  prepare(params: ContextParams): Promise<void> {
    let preparation = this.preparations.get(params.context);
    if (!preparation) {
      preparation = this.start(params);
      this.preparations.set(params.context, preparation);
    }
    return preparation.then(
      () => {},
      () => {},
    );
  }

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
    const preparation = this.preparations.get(params.context);
    this.preparations.delete(params.context);
    let started = await (preparation ?? this.start(params));
    if (preparation) {
      const file = await started.paths.resolve(
        path.resolve(started.paths.sourceRoot, params.postcss),
      );
      if (file !== started.file) {
        const key = JSON.stringify([params.context, started.file]);
        if (
          !this.used.has(started.worker) &&
          this.workers.get(key) === started.worker
        ) {
          this.workers.delete(key);
          await this.stop(started.worker);
        }
        started = await this.start(params);
      }
    }
    const { paths, worker } = started;
    const physical = stylesheetSource(paths, params.sourcePath);
    const sourcePath = (await sourceDependency(paths, physical)) ?? physical;
    this.used.add(worker);
    return worker.request(++this.id, { ...params, sourcePath });
  }

  private start(params: ContextParams): Promise<Started> {
    const owner = { active: !this.stopped };
    let starting = this.starting.get(params.context);
    if (!starting) this.starting.set(params.context, (starting = new Set()));
    starting.add(owner);
    return this.load(params, owner).finally(() => {
      starting.delete(owner);
      if (!starting.size && this.starting.get(params.context) === starting)
        this.starting.delete(params.context);
    });
  }

  private async load(
    params: ContextParams,
    owner: { active: boolean },
  ): Promise<Started> {
    const paths = await ModulePaths.create(params);
    const root = paths.sourceRoot;
    const file = await paths.resolve(path.resolve(root, params.postcss));
    if (!/\.(ts|mts|js|mjs|cjs)$/.test(file))
      throw new SidecarError(
        "bundle-failed",
        "postcss module has an unsupported suffix",
      );
    if (!owner.active)
      throw new SidecarError("bundle-failed", "PostCSS context was disposed");
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
            NODE_OPTIONS: [
              `--require=${JSON.stringify(fileURLToPath(new URL("./postcss-preload.cjs", import.meta.url)))}`,
              process.env.NODE_OPTIONS,
            ]
              .filter(Boolean)
              .join(" "),
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
      worker = new PostcssProcess(child, closed, this.phase);
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      observePostcssProcess(child, closed, this.operation);
      child.stdout?.on("data", (chunk) => this.diagnostic(String(chunk)));
      child.stderr?.on("data", (chunk) => this.diagnostic(String(chunk)));
      this.workers.set(key, worker);
      worker.send({
        context: params.context,
        postcss: file,
        sourceRoot: root,
        moduleResolution: params.moduleResolution,
        repositoryRoots: paths.repositoryRoots,
      });
    }
    return { paths, file, worker };
  }

  async dispose(context?: string): Promise<void> {
    if (context === undefined) this.stopped = true;
    for (const [id, starting] of this.starting)
      if (context === undefined || id === context) {
        for (const owner of starting) owner.active = false;
        this.starting.delete(id);
      }
    for (const id of this.preparations.keys())
      if (context === undefined || id === context) this.preparations.delete(id);
    const selected = [...this.workers].filter(
      ([key]) => context === undefined || JSON.parse(key)[0] === context,
    );
    for (const [key] of selected) this.workers.delete(key);
    await Promise.all(selected.map(([, worker]) => this.stop(worker)));
  }

  private async stop({ child: worker }: PostcssProcess): Promise<void> {
    if (worker.exitCode !== null || worker.signalCode !== null) return;
    const exited = once(worker, "exit");
    worker.kill("SIGKILL");
    await exited;
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
