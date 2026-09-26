import type { ComponentRuntime } from "../build/component_runtime.js";
import { prepareLiveRuntime } from "../build/live_runtime.js";
import { loadConsumerGraph } from "../build/load_graph.js";
import type { BuildWarning } from "../build/warnings.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import { prepareRegistry } from "../registry/prepare.js";

import { watcherReadyBeforeShutdown } from "./serve_lifecycle.js";
import type { NotificationGate, WatchEvent } from "./watch_events.js";
import { watchTargets } from "./watch_paths.js";
import {
  createSourceWatcher,
  type ConsumerWatcher,
  type ConsumerWatcherFactory,
} from "./watcher.js";

export interface PreparedWatchedSource {
  runtime: ComponentRuntime;
  watcher: ConsumerWatcher;
}

export function sourceTargetsChanged(
  current: ResolvedConfig,
  next: ResolvedConfig,
): boolean {
  return (
    JSON.stringify(watchTargets(current)) !== JSON.stringify(watchTargets(next))
  );
}

export async function prepareInitialWatchedSource(
  config: ResolvedConfig,
  factory: ConsumerWatcherFactory,
  gate: NotificationGate<WatchEvent>,
  report: (error: unknown) => void,
  shutdown: Promise<void>,
  isClosed: () => boolean,
  onWarning?: (warning: BuildWarning) => void,
): Promise<PreparedWatchedSource> {
  const prepared = await prepareWatchedSource(
    config,
    factory,
    gate,
    report,
    shutdown,
    isClosed,
    onWarning,
  );
  if (!prepared)
    throw new MoklyError(
      "build-invalid",
      "watched startup stopped before readiness",
    );
  return prepared;
}

export async function prepareWatchedSource(
  config: ResolvedConfig,
  factory: ConsumerWatcherFactory,
  gate: NotificationGate<WatchEvent>,
  report: (error: unknown) => void,
  shutdown: Promise<void>,
  isClosed: () => boolean,
  onWarning?: (warning: BuildWarning) => void,
): Promise<PreparedWatchedSource | undefined> {
  config.warnings?.forEach(onWarning ?? (() => undefined));
  const inventory = await loadConsumerGraph(config, false);
  config.entryModules = inventory.entrySources;
  config.sourceFiles = inventory.sourceFiles;
  const initialTargets = watchTargets(config);
  let watcher = createSourceWatcher(factory, config, gate, report);
  let retained = false;
  try {
    const ready = await timeAsync("watch.source-ready", () =>
      watcherReadyBeforeShutdown(watcher, shutdown),
    );
    if (!ready || isClosed()) return;
    const graph = await loadConsumerGraph(config);
    if (isClosed()) return;
    config.entryModules = graph.entrySources;
    config.sourceFiles = graph.sourceFiles;
    const registry = prepareRegistry(graph.definitions, config, onWarning);
    if (isClosed()) return;
    if (
      JSON.stringify(initialTargets) !== JSON.stringify(watchTargets(config))
    ) {
      const extended = createSourceWatcher(factory, config, gate, report);
      let adopted = false;
      try {
        const ready = await timeAsync("watch.source-ready", () =>
          watcherReadyBeforeShutdown(extended, shutdown),
        );
        if (!ready || isClosed()) return;
        await watcher.close();
        watcher = extended;
        adopted = true;
      } finally {
        if (!adopted) await extended.close();
      }
    }
    const runtime = await prepareLiveRuntime(
      config,
      graph,
      registry,
      onWarning,
    );
    if (isClosed()) return;
    retained = true;
    return { runtime, watcher };
  } finally {
    if (!retained) await watcher.close();
  }
}
