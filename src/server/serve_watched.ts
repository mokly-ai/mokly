/** Watched Serve adopts lightweight generations; exhaustive work follows in the background. */
import { randomBytes } from "node:crypto";

import type { Compilation } from "../build/compile.js";
import type { ComponentRuntime } from "../build/component_runtime.js";
import { prepareLiveRuntime } from "../build/live_runtime.js";
import { loadConsumerGraph } from "../build/load_graph.js";
import type { ResolvedConfig } from "../config/types.js";
import { bindTimings, timeAsync } from "../diagnostics/timings.js";

import { RepositoryCatalogueChangeClassifier } from "./component_changes.js";
import { BackgroundGeneration } from "./demand/generation.js";
import {
  GitReferenceObserver,
  RepositoryGitReferences,
} from "./demand/git_references.js";
import { PreviewResources } from "./demand/resources.js";
import { PlainServeReporter } from "./reporter.js";
import { ResourceWatcher } from "./resource_watcher.js";
import type { RunningServe, ServeDependencies, ServeOptions } from "./serve.js";
import {
  closeWatched,
  createWatchedSupervisor,
  restartWithRecovery,
  watcherReadyBeforeShutdown,
} from "./serve_lifecycle.js";
import type { ProcessSupervisor } from "./supervisor.js";
import {
  classifyWatchPath,
  NotificationGate,
  type RuntimeWatchAction,
  WatchActionQueue,
  WatchDebouncer,
  watchTargets,
} from "./watch_events.js";
import { createSourceWatcher } from "./watcher.js";

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
  const gate = new NotificationGate<string>();
  const failures = new NotificationGate<Error>();
  const report = (error: unknown) => reporter.runtimeDiagnostic(error);
  config.sourceFiles = (await loadConsumerGraph(config, false)).sourceFiles;
  let activeConfig = config;
  let watcher = createSourceWatcher(watcherFactory, config, gate, report);
  const resources = new ResourceWatcher(
    watcherFactory,
    (candidate) => gate.notify(candidate),
    report,
  );
  let runtime: ComponentRuntime;
  let activeCompilation: Compilation | undefined;
  let signature: string;
  let supervisor: ProcessSupervisor | undefined;
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
    (candidate) => gate.notify(candidate),
    () => runtime,
    shutdown,
    report,
  );
  running.onPreviewResources?.((observation) => previews.observe(observation));
  let generationStartedAt = Date.now();
  let changesStartedAt = generationStartedAt;
  let baselineStartedAt = generationStartedAt;
  let reportCatalogue = true;
  const background = new BackgroundGeneration(
    outputStore,
    classifier,
    (compilation, accepted) => {
      changesStartedAt = Date.now();
      if (reportCatalogue)
        reporter.catalogueReady(
          compilation.manifest,
          changesStartedAt - generationStartedAt,
        );
      activeCompilation = compilation;
      running.completeCatalogue?.(compilation.manifest, accepted.generation);
    },
    (snapshot) => {
      const duration = Date.now() - changesStartedAt;
      if (snapshot)
        reporter.changesReady(snapshot.changedRoutes?.length ?? 0, duration);
      else reporter.changesUnavailable(duration);
      running.notifyUpdate(
        snapshot?.changedRoutes,
        snapshot,
        snapshot ? "ready" : "unavailable",
        "evidence",
      );
    },
    {
      baselinePrepared: (commit) =>
        running.notifyUpdate(
          undefined,
          undefined,
          "pending",
          "evidence",
          commit,
        ),
      baselineStatus: (changesStatus) =>
        running.notifyUpdate(undefined, undefined, changesStatus, "evidence"),
      baselineProgress: (event) => {
        if (event.type === "start") {
          baselineStartedAt = Date.now();
          reporter.baselinePreparing(options.base ?? activeConfig.review.base);
        }
        if (event.type === "complete")
          reporter.baselineReady(
            event.commit,
            event.cacheHit,
            Date.now() - baselineStartedAt,
          );
      },
      diagnostic: report,
      resources,
      shutdown,
      ...(dependencies.baselineBuilder
        ? { builder: dependencies.baselineBuilder }
        : {}),
    },
  );
  running.onForeground?.((active) => background.foreground(active));
  const schedule = (existing?: Compilation) => {
    generationStartedAt = Date.now();
    changesStartedAt = generationStartedAt;
    reportCatalogue = existing === undefined;
    background.start(
      runtime,
      options.base ?? activeConfig.review.base,
      existing,
    );
  };
  let debouncer: WatchDebouncer | undefined;
  const notify = (candidate: string) => {
    const action = classifyWatchPath(
      candidate,
      activeConfig,
      new Set([...resources.paths, ...previews.paths]),
    );
    debouncer?.notify(action, candidate);
  };

  const restart = async () => {
    try {
      await restartWithRecovery(running);
      running.notifyUpdate(
        undefined,
        undefined,
        background.changesStatus,
        "evidence",
      );
    } finally {
      if (!closed) schedule(activeCompilation);
    }
  };

  const reconfigure = async (candidate?: ResolvedConfig): Promise<void> => {
    const nextConfig =
      candidate ?? (await configLoader.load(activeConfig.configPath));
    nextConfig.sourceFiles = (
      await loadConsumerGraph(nextConfig, false)
    ).sourceFiles;
    const nextGate = new NotificationGate<string>();
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
      activeConfig = next.config;
      runtime = next;
      activeCompilation = undefined;
      references.replace(
        activeConfig.repoRoot,
        options.base ?? activeConfig.review.base,
      );
      signature = JSON.stringify(next.manifest);
      running.replaceComponentRuntime(next, "stage");
      watcher = replacement;
      adopted = true;
      debouncer?.close();
      debouncer = new WatchDebouncer(
        activeConfig.watch.debounceMs,
        (action, paths) => queue.notify(action, paths),
      );
      nextGate.open(bindTimings(notify));
      try {
        await previous.close();
      } finally {
        if (!closed) await restart();
      }
    } finally {
      if (!adopted) await replacement.close();
    }
  };

  const performAction = async (action: RuntimeWatchAction): Promise<void> => {
    if (closed) return;
    if (action === "reconfigure") return reconfigure();
    if (action === "evidence") {
      if (activeCompilation) {
        await background.invalidate();
        if (!closed) {
          running.notifyUpdate(
            undefined,
            undefined,
            background.changesStatus,
            "evidence",
          );
          schedule(activeCompilation);
        }
      }
      return;
    }
    if (action === "rebuild") {
      const next = await prepareLiveRuntime(activeConfig);
      if (
        JSON.stringify(watchTargets(next.config)) !==
        JSON.stringify(watchTargets(activeConfig))
      )
        return reconfigure(next.config);
      if (closed) return;
      await background.invalidate();
      if (closed) return;
      activeConfig = next.config;
      runtime = next;
      activeCompilation = undefined;
      const nextSignature = JSON.stringify(next.manifest);
      running.replaceComponentRuntime(
        next,
        nextSignature === signature ? "live" : "stage",
      );
      if (nextSignature !== signature) {
        signature = nextSignature;
        await restart();
      } else {
        running.notifyUpdate(undefined, undefined, background.changesStatus);
        schedule();
      }
      return;
    }
    await background.invalidate();
    if (closed) return;
    runtime = { ...runtime, generation: randomBytes(16).toString("hex") };
    running.replaceComponentRuntime(
      runtime,
      action === "reload" ? "live" : "stage",
    );
    if (action === "reload") {
      running.notifyUpdate(undefined, undefined, background.changesStatus);
      schedule(activeCompilation);
    } else await restart();
  };
  const processAction = async (
    action: RuntimeWatchAction,
    paths: readonly string[],
  ): Promise<void> => {
    const reportable = action !== "evidence" || paths.length > 0;
    const startedAt = Date.now();
    const watchReport = (durationMs: number) => ({
      action,
      durationMs,
      paths,
      repoRoot: activeConfig.repoRoot,
    });
    if (reportable) reporter.watchStarted(watchReport(0));
    try {
      await performAction(action);
      if (reportable)
        reporter.watchFinished(watchReport(Date.now() - startedAt));
    } catch (error) {
      reporter.watchFailed(watchReport(Date.now() - startedAt), error);
    }
  };
  const queue = new WatchActionQueue(processAction, report);
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
  schedule();
  references.replace(
    activeConfig.repoRoot,
    options.base ?? activeConfig.review.base,
  );
  return {
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
