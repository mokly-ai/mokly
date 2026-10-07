import { enforceStrictBuildWarnings } from "../build/build_warnings.js";
import { compileCatalogue, type Compilation } from "../build/compile.js";
import { componentRuntime } from "../build/component_runtime.js";
import {
  FileSystemGeneratedOutputStore,
  type GeneratedOutputStore,
} from "../build/output_store.js";
import { generatedOutputSummary } from "../build/output_summary.js";
import { loadConfig } from "../config/load.js";
import type { ResolvedConfig } from "../config/types.js";
import { refreshResourceCompilation } from "../server/resource_compilation.js";
import type { PreparedResourceWatch } from "../server/resource_watcher.js";
import {
  WatchActionQueue,
  WatchDebouncer,
  type WatchEvent,
} from "../server/watch_events.js";
import { WatchSetup, type PreparedSourceWatch } from "../server/watch_setup.js";
import {
  ChokidarWatcherFactory,
  type ConsumerWatcherFactory,
} from "../server/watcher.js";

import type { CliReporter } from "./reporter/index.js";

/** Watch the same classified consumer inputs as Serve, writing only complete builds. */
export async function watchBuild(
  initial: ResolvedConfig,
  cwd: string,
  reporter: CliReporter,
  factory: ConsumerWatcherFactory = new ChokidarWatcherFactory(),
  store: GeneratedOutputStore = new FileSystemGeneratedOutputStore(),
  strict = false,
): Promise<void> {
  let config = initial;
  let closed = false;
  const controller = new AbortController();
  let latest: Compilation | undefined;
  let stop: () => void = () => {};
  const stopped = new Promise<void>((resolve) => {
    stop = resolve;
  });
  const report = (error: unknown) => {
    if (!closed) reporter.runtimeDiagnostic(error);
  };
  const watches = new WatchSetup(config, factory, stopped, report);

  const output = async (reconfigure = false) => {
    if (closed) return;
    const started = reporter.environment.now();
    const requested = reconfigure
      ? await loadConfig(config.repoRoot, config.configPath)
      : config;
    let source: PreparedSourceWatch | undefined;
    let resources: PreparedResourceWatch | undefined;
    try {
      source = await watches.prepare(requested, true, reconfigure);
      if (!source || closed) return;
      const inputs = source.config;
      if (!reconfigure) {
        source.adopt();
        await source.close();
        source = undefined;
      }
      let compilation = await compileCatalogue(
        inputs,
        undefined,
        controller.signal,
      );
      if (closed) return;
      const next = componentRuntime(compilation).config;
      source = await watches.refine(next, source);
      if (!source || closed) return;
      resources = await watches.resources.prepare(next, compilation, stopped);
      if (closed) return;
      compilation = refreshResourceCompilation(compilation, resources);
      reporter.buildWarnings(compilation.diagnostics);
      enforceStrictBuildWarnings(compilation.diagnostics, strict);
      await store.write(compilation, next, controller.signal);
      source.adopt(next);
      resources?.adopt();
      latest = compilation;
      config = next;
      reporter.outputWritten?.(
        generatedOutputSummary(compilation, config, cwd),
        reporter.environment.now() - started,
      );
    } catch (error) {
      if (!closed && latest) {
        const recovery = await watches.resources.prepare(
          config,
          latest,
          stopped,
          true,
        );
        try {
          recovery?.adopt();
        } finally {
          await recovery?.close();
        }
      }
      throw error;
    } finally {
      await resources?.close();
      await source?.close();
    }
  };
  const queue = new WatchActionQueue(async (action) => {
    if (closed || action === "evidence") return;
    await output(action === "reconfigure");
  }, report);
  const createDebouncer = () =>
    new WatchDebouncer(
      () => config.watch.debounceMs,
      (action, paths) => queue.notify(action, paths),
    );
  const debouncer = createDebouncer();
  const notify = (event: WatchEvent) =>
    debouncer.notify(watches.classify(event), event.path);
  const onSignal = () => {
    closed = true;
    controller.abort();
    stop();
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    try {
      await output();
    } catch (error) {
      report(error);
      if (!closed && !latest) {
        const fallback = await watches.prepare(watches.config, false);
        fallback?.adopt();
        await fallback?.close();
      }
    }
    if (!closed) watches.open(notify);
    await stopped;
  } finally {
    closed = true;
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    debouncer.close();
    await queue.close();
    await watches.close();
  }
}
