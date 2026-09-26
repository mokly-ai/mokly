/** Shutdown and child-restart helpers for watched Serve orchestration. */
import { fileURLToPath } from "node:url";

import type { Compilation } from "../build/compile.js";
import type { ComponentRuntime } from "../build/component_runtime.js";
import type { GeneratedOutputStore } from "../build/output_store.js";
import type { BuildWarning } from "../build/warnings.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timingArguments } from "../diagnostics/timings.js";

import type { RunningServer } from "./http_types.js";
import type {
  PreparedResourceWatch,
  ResourceWatcher,
} from "./resource_watcher.js";
import type { RunningServe, ServeOptions } from "./serve.js";
import type {
  ProcessSupervisor,
  ProcessSupervisorFactory,
} from "./supervisor.js";
import type { NotificationGate, WatchActionQueue } from "./watch_events.js";
import type { ConsumerWatcher } from "./watcher.js";

/** Keep CLI child configuration, including diagnostic opt-in, stable across restarts. */
export function createWatchedSupervisor(
  config: ResolvedConfig,
  options: ServeOptions,
  factory: ProcessSupervisorFactory,
): ProcessSupervisor {
  return factory.create(
    fileURLToPath(new URL("../cli/bin.js", import.meta.url)),
    [
      "__serve-child",
      ...timingArguments(),
      "--config",
      config.configPath,
      ...(options.base !== undefined ? ["--base", options.base] : []),
    ],
    options.port,
  );
}

/** Attach warning and failure observers before child readiness, cleaning up on failure. */
export async function startWatchedSupervisor(
  config: ResolvedConfig,
  options: ServeOptions,
  factory: ProcessSupervisorFactory,
  runtime: ComponentRuntime,
  failures: NotificationGate<Error>,
  onWarning: (warning: BuildWarning) => void,
  watcher: ConsumerWatcher,
  resources: ResourceWatcher,
): Promise<{ running: ProcessSupervisor; port: number }> {
  const running = createWatchedSupervisor(config, options, factory);
  try {
    running.onUnexpectedExit((error) => failures.notify(error));
    running.onWarning?.(onWarning);
    running.replaceComponentRuntime(runtime, "stage");
    const port = await timeAsync("child.ready", () => running.start());
    return { running, port };
  } catch (error) {
    await Promise.allSettled([
      watcher.close(),
      resources.close(),
      running.close(),
    ]);
    throw error;
  }
}

/** Present a deterministic child server through the public Serve lifecycle. */
export function serverLifecycle(server: RunningServer): RunningServe {
  return { close: () => server.close(), port: server.port, url: server.url };
}

/** Stop waiting for a candidate watcher as soon as watched shutdown begins. */
export async function watcherReadyBeforeShutdown(
  watcher: ConsumerWatcher,
  shutdownStarted: Promise<void>,
): Promise<boolean> {
  return Promise.race([
    watcher.ready().then(() => true),
    shutdownStarted.then(() => false),
  ]);
}

/** Write candidate output only after its resource watches are ready. */
export async function prepareWatchedOutput(
  config: ResolvedConfig,
  compilation: Compilation,
  resources: ResourceWatcher,
  outputStore: GeneratedOutputStore,
  shutdownStarted: Promise<void>,
  isClosed: () => boolean,
): Promise<PreparedResourceWatch | undefined> {
  const prepared = await resources.prepare(
    config,
    compilation,
    shutdownStarted,
  );
  if (!prepared) return undefined;
  try {
    if (!isClosed()) await outputStore.write(compilation, config);
    if (!isClosed()) return prepared;
  } catch (error) {
    await prepared.close();
    throw error;
  }
  await prepared.close();
  return undefined;
}

/** Close queued work, active watchers, and child while preserving first failure. */
export async function closeWatched(
  actionQueue: WatchActionQueue,
  currentWatcher: () => ConsumerWatcher,
  resources: ResourceWatcher,
  supervisor: ProcessSupervisor,
): Promise<void> {
  let firstError: unknown;
  for (const close of [
    () => actionQueue.close(),
    () => currentWatcher().close(),
    () => resources.close(),
    () => supervisor.close(),
  ]) {
    try {
      await close();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError !== undefined) throw firstError;
}

/** Restore a child after a failed restart while still reporting the failure. */
export async function restartWithRecovery(
  supervisor: ProcessSupervisor,
): Promise<void> {
  try {
    await supervisor.restart();
  } catch (restartError) {
    try {
      await supervisor.start();
    } catch {
      throw restartError;
    }
    throw restartError;
  }
}
