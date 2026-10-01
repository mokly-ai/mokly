/** Watched Serve adopts lightweight generations; exhaustive work follows in the background. */

import type { ComponentRuntime } from "../build/component_runtime.js";
import { prepareLiveRuntime } from "../build/live_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { bindTimings, timeAsync } from "../diagnostics/timings.js";

import { RepositoryCatalogueChangeClassifier } from "./component_changes.js";
import {
  GitReferenceObserver,
  RepositoryGitReferences,
} from "./demand/git_references.js";
import { PreviewResources } from "./demand/resources.js";
import {
  WatchedRebuildStatus,
  type WatchRebuildStatus,
} from "./rebuild_status.js";
import { PlainServeReporter } from "./reporter.js";
import { ResourceWatcher } from "./resource_watcher.js";
import type { RunningServe, ServeDependencies, ServeOptions } from "./serve.js";
import {
  closeWatched,
  createWatchedSupervisor,
  refreshWatchedSourceInventory,
  watchedInteractiveAddress,
  watcherReadyBeforeShutdown,
} from "./serve_lifecycle.js";
import type { ProcessSupervisor } from "./supervisor_types.js";
import { type WatchActionDelivery } from "./watch_action_outcome.js";
import {
  PhasedWatchActionProcessor,
  type WatchActionProcessor,
  type WatchRuntimeDelivery,
  WatchedRuntimeDelivery,
} from "./watch_action_processor.js";
import {
  classifyWatchPath,
  NotificationGate,
  WatchActionQueue,
  WatchDebouncer,
  type WatchEvent,
} from "./watch_events.js";
import { watchTargets } from "./watch_paths.js";
import { reportedWatchProcessor } from "./watch_reporting.js";
import { WatchedBackground } from "./watched_background.js";
import { createSourceWatcher } from "./watcher.js";

/** Serve accepted generations while watching typed source and resource changes. */
export async function serveWatched(
  config: ResolvedConfig,
  options: ServeOptions,
  dependencies: ServeDependencies,
): Promise<RunningServe> {
  const {
    configLoader,
    watcherFactory,
    outputStore,
    processSupervisorFactory,
  } = dependencies;
  const reporter = dependencies.reporter ?? new PlainServeReporter();
  const classifier =
    dependencies.changeClassifier ?? new RepositoryCatalogueChangeClassifier();
  let closed = false;
  let signalShutdown: () => void = () => {};
  const shutdown = new Promise<void>((resolve) => {
    signalShutdown = resolve;
  });
  const report = (error: unknown) => reporter.runtimeDiagnostic(error);
  const gate = new NotificationGate<WatchEvent>(report);
  const failures = new NotificationGate<Error>(report);
  await refreshWatchedSourceInventory(config);
  let activeConfig = config;
  let watcher = createSourceWatcher(watcherFactory, config, gate, report);
  const resources = new ResourceWatcher(
    watcherFactory,
    (event) => gate.notify(event),
    report,
  );
  let runtime: ComponentRuntime;
  let signature: string;
  let supervisor: ProcessSupervisor | undefined;
  let rebuildStatus: WatchRebuildStatus;
  let port: number;
  try {
    await timeAsync("watch.source-ready", () => watcher.ready());
    runtime = await prepareLiveRuntime(config);
    activeConfig = runtime.config;
    signature = JSON.stringify(runtime.manifest);
    supervisor = createWatchedSupervisor(
      activeConfig,
      options,
      processSupervisorFactory,
    );
    rebuildStatus = new WatchedRebuildStatus(
      supervisor,
      () => activeConfig.repoRoot,
    );
    supervisor.onUnexpectedExit((error) => failures.notify(error));
    supervisor.replaceComponentRuntime(runtime, "stage");
    port = await timeAsync("child.ready", () => supervisor!.start());
  } catch (error) {
    await Promise.allSettled([
      watcher.close(),
      resources.close(),
      supervisor?.close(),
    ]);
    throw error;
  }
  const running = supervisor;
  running.onDiagnostic?.((message) => reporter.runtimeDiagnostic(message));
  const previews = new PreviewResources(
    watcherFactory,
    (event) => gate.notify(event),
    () => runtime,
    shutdown,
    report,
  );
  running.onPreviewResources?.((observation) => previews.observe(observation));
  const background = new WatchedBackground({
    ...(dependencies.baselineBuilder
      ? { baselineBuilder: dependencies.baselineBuilder }
      : {}),
    ...(options.base !== undefined ? { base: options.base } : {}),
    classifier,
    config: () => activeConfig,
    outputStore,
    report,
    reporter,
    resources,
    running,
    runtime: () => runtime,
    shutdown,
  });
  running.onForeground?.((active) => background.foreground(active));
  const delivery: WatchRuntimeDelivery = new WatchedRuntimeDelivery({
    background,
    isClosed: () => closed,
    running,
    runtime: {
      current: () => runtime,
      replace: (next) => {
        runtime = next;
      },
    },
  });
  let debouncer: WatchDebouncer | undefined;
  const notify = (event: WatchEvent) => {
    const action = classifyWatchPath(
      event,
      activeConfig,
      new Set([...resources.paths, ...previews.paths]),
    );
    debouncer?.notify(action, event.path);
  };

  const reconfigureSource = async (
    candidate?: ResolvedConfig,
  ): Promise<WatchActionDelivery | undefined> => {
    const nextConfig =
      candidate ?? (await configLoader.load(activeConfig.configPath));
    await refreshWatchedSourceInventory(nextConfig);
    const nextGate = new NotificationGate<WatchEvent>(report);
    const replacement = createSourceWatcher(
      watcherFactory,
      nextConfig,
      nextGate,
      report,
    );
    let adopted = false;
    try {
      if (!(await watcherReadyBeforeShutdown(replacement, shutdown)) || closed)
        return;
      const next = await prepareLiveRuntime(nextConfig);
      if (closed) return;
      await background.invalidate(next.config);
      if (closed) return;
      const previous = watcher;
      const version = running.reserveUpdateVersion();
      running.replaceComponentRuntime(next, "stage");
      activeConfig = next.config;
      runtime = next;
      background.clearCompilation();
      signature = JSON.stringify(next.manifest);
      adopted = true;
      return async () => {
        watcher = replacement;
        rebuildStatus.sourceSucceeded(version);
        references.replace(
          activeConfig.repoRoot,
          options.base ?? activeConfig.review.base,
        );
        debouncer?.close();
        debouncer = new WatchDebouncer(
          activeConfig.watch.debounceMs,
          (action, paths) => queue.notify(action, paths),
        );
        nextGate.open(bindTimings(notify));
        try {
          await previous.close();
        } finally {
          if (!closed) await delivery.restart(version);
        }
      };
    } finally {
      if (!adopted) await replacement.close();
    }
  };

  const rebuildSource = async (): Promise<WatchActionDelivery | undefined> => {
    const next = await prepareLiveRuntime(activeConfig);
    if (
      JSON.stringify(watchTargets(next.config)) !==
      JSON.stringify(watchTargets(activeConfig))
    )
      return reconfigureSource(next.config);
    if (closed) return;
    await background.invalidate();
    if (closed) return;
    const nextSignature = JSON.stringify(next.manifest);
    const restartRequired = nextSignature !== signature;
    const version = running.reserveUpdateVersion();
    running.replaceComponentRuntime(next, "stage");
    activeConfig = next.config;
    runtime = next;
    background.clearCompilation();
    if (restartRequired) signature = nextSignature;
    return async () => {
      rebuildStatus.sourceSucceeded(version);
      if (restartRequired) {
        await delivery.restart(version);
        return;
      }
      running.replaceComponentRuntime(
        next,
        "live",
        version,
        background.changesStatus,
      );
      background.schedule();
    };
  };

  const actionProcessor: WatchActionProcessor = new PhasedWatchActionProcessor({
    delivery,
    isClosed: () => closed,
    rebuild: rebuildSource,
    reconfigure: () => reconfigureSource(),
  });
  const queue = new WatchActionQueue(
    reportedWatchProcessor(
      (action) => actionProcessor.process(action),
      reporter,
      () => activeConfig.repoRoot,
      rebuildStatus,
    ),
    report,
    rebuildStatus,
  );
  const references = new GitReferenceObserver(
    new RepositoryGitReferences(),
    (initial) => {
      const base = options.base ?? activeConfig.review.base;
      if (!initial) reporter.gitReferenceRefresh(base);
      queue.notify("evidence", initial ? [] : [base]);
    },
  );
  debouncer = new WatchDebouncer(
    activeConfig.watch.debounceMs,
    (action, paths) => queue.notify(action, paths),
  );
  failures.open((error) => {
    if (!closed) {
      report(error);
      queue.notify("restart");
    }
  });
  gate.open(bindTimings(notify));
  background.schedule();
  references.replace(
    activeConfig.repoRoot,
    options.base ?? activeConfig.review.base,
  );
  return {
    ...watchedInteractiveAddress(options, running),
    port,
    rebuild: () => queue.notify("rebuild"),
    url: `http://127.0.0.1:${port}`,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      signalShutdown();
      debouncer?.close();
      await references.close();
      await background.close();
      await previews.close();
      await closeWatched(queue, () => watcher, resources, running);
    },
  };
}
