import path from "node:path";

import { compileCatalogue } from "../build/compile.js";
import {
  FileSystemGeneratedOutputStore,
  type GeneratedOutputStore,
} from "../build/output_store.js";
import { loadConfig } from "../config/load.js";
import type { ResolvedConfig } from "../config/types.js";
import {
  classifyWatchPath,
  NotificationGate,
  WatchActionQueue,
  WatchDebouncer,
  type WatchEvent,
} from "../server/watch_events.js";
import { watchTargets } from "../server/watch_paths.js";
import {
  ChokidarWatcherFactory,
  createSourceWatcher,
  type ConsumerWatcher,
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
): Promise<void> {
  let config = initial;
  let closed = false;
  const report = (error: unknown) => reporter.runtimeDiagnostic(error);
  const events = new NotificationGate<WatchEvent>(report);
  const watcher = createSourceWatcher(factory, config, events, report);
  let current: ConsumerWatcher = watcher;
  let targets = JSON.stringify(watchTargets(config));
  let debouncer: WatchDebouncer;
  const refreshSources = async () => {
    const nextTargets = JSON.stringify(watchTargets(config));
    if (nextTargets === targets || closed) return;
    const nextEvents = new NotificationGate<WatchEvent>(report);
    const replacement = createSourceWatcher(
      factory,
      config,
      nextEvents,
      report,
    );
    try {
      await replacement.ready();
      if (closed) return;
      const previous = current;
      current = replacement;
      targets = nextTargets;
      nextEvents.open(notify);
      await previous.close();
    } finally {
      if (current !== replacement) await replacement.close();
    }
  };
  const output = async () => {
    const started = reporter.environment.now();
    const compilation = await compileCatalogue(config);
    if (closed) return;
    await store.write(compilation, config);
    config.sourceFiles = compilation.manifest.sourceFiles;
    await refreshSources();
    reporter.summary(
      `Generated ${compilation.outputs.size} Mokly files.\n`,
      `Generated ${compilation.outputs.size} files in ${path.relative(cwd, config.mockupsDir) || "."}`,
      reporter.environment.now() - started,
    );
  };
  const queue = new WatchActionQueue(async (action) => {
    if (action === "evidence") return;
    if (action === "reconfigure") {
      const next = await loadConfig(config.repoRoot, config.configPath);
      const nextEvents = new NotificationGate<WatchEvent>(report);
      const replacement = createSourceWatcher(
        factory,
        next,
        nextEvents,
        report,
      );
      try {
        await replacement.ready();
        if (closed) return;
        const previous = current;
        current = replacement;
        config = next;
        targets = JSON.stringify(watchTargets(next));
        debouncer.close();
        debouncer = new WatchDebouncer(config.watch.debounceMs, (kind, paths) =>
          queue.notify(kind, paths),
        );
        nextEvents.open(notify);
        await previous.close();
      } finally {
        if (current !== replacement) await replacement.close();
      }
    }
    await output();
  }, report);
  debouncer = new WatchDebouncer(config.watch.debounceMs, (action, paths) =>
    queue.notify(action, paths),
  );
  const notify = (event: WatchEvent) => {
    debouncer.notify(classifyWatchPath(event, config), event.path);
  };
  let stop: () => void = () => {};
  const stopped = new Promise<void>((resolve) => {
    stop = resolve;
  });
  const onSignal = () => stop();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    await watcher.ready();
    try {
      await output();
    } catch (error) {
      report(error);
    }
    if (current === watcher) events.open(notify);
    await stopped;
  } finally {
    closed = true;
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    debouncer.close();
    await queue.close();
    await current.close();
  }
}
