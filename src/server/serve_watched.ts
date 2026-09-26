/** Watched Serve adopts lightweight generations; exhaustive work follows in the background. */
import { randomBytes } from "node:crypto";

import type { ComponentRuntime } from "../build/component_runtime.js";
import { prepareLiveRuntime } from "../build/live_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { bindTimings } from "../diagnostics/timings.js";

import { RepositoryCatalogueChangeClassifier } from "./component_changes.js";
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
  restartWithRecovery,
  startWatchedSupervisor,
} from "./serve_lifecycle.js";
import {
  classifyWatchPath,
  NotificationGate,
  type RuntimeWatchAction,
  WatchActionQueue,
  WatchDebouncer,
  type WatchEvent,
} from "./watch_events.js";
import {
  prepareInitialWatchedSource,
  prepareWatchedSource,
  sourceTargetsChanged,
} from "./watch_preparation.js";
import { reportedWatchProcessor } from "./watch_reporting.js";
import { scopedWatchWarnings } from "./watch_warning_scopes.js";
import { WatchedBackground } from "./watched_background.js";

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
  const warnings = dependencies.warnings!;
  const warn = warnings.add.bind(warnings);
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
  const prepared = await prepareInitialWatchedSource(
    config,
    watcherFactory,
    gate,
    report,
    shutdown,
    () => closed,
    warn,
  );
  let activeConfig = prepared.runtime.config;
  let watcher = prepared.watcher;
  const resources = new ResourceWatcher(
    watcherFactory,
    (event) => gate.notify(event),
    report,
  );
  let runtime: ComponentRuntime = prepared.runtime;
  let signature = JSON.stringify(runtime.manifest);
  const { running, port } = await startWatchedSupervisor(
    activeConfig,
    options,
    processSupervisorFactory,
    runtime,
    failures,
    warn,
    watcher,
    resources,
  );
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
    warnings,
    resources,
    running,
    runtime: () => runtime,
    shutdown,
  });
  running.onForeground?.((active) => background.foreground(active));
  let debouncer: WatchDebouncer | undefined;
  const notify = (event: WatchEvent) => {
    const action = classifyWatchPath(
      event,
      activeConfig,
      new Set([...resources.paths, ...previews.paths]),
    );
    debouncer?.notify(action, event.path);
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
      if (!closed) background.schedule(background.compilation);
    }
  };

  const reconfigure = async (candidate?: ResolvedConfig): Promise<void> => {
    const nextConfig =
      candidate ?? (await configLoader.load(activeConfig.configPath, warn));
    const nextGate = new NotificationGate<WatchEvent>(report);
    const prepared = await prepareWatchedSource(
      nextConfig,
      watcherFactory,
      nextGate,
      report,
      shutdown,
      () => closed,
      warn,
    );
    if (!prepared) return;
    const { watcher: replacement, runtime: next } = prepared;
    let adopted = false;
    try {
      if (closed) return;
      await background.invalidate(next.config);
      if (closed) return;
      const previous = watcher;
      activeConfig = next.config;
      runtime = next;
      background.clearCompilation();
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
      if (background.compilation) {
        await background.invalidate();
        if (!closed) {
          running.notifyUpdate(
            undefined,
            undefined,
            background.changesStatus,
            "evidence",
          );
          background.schedule(background.compilation);
        }
      }
      return;
    }
    if (action === "rebuild") {
      const next = await prepareLiveRuntime(
        activeConfig,
        undefined,
        undefined,
        warn,
      );
      if (sourceTargetsChanged(activeConfig, next.config))
        return reconfigure(next.config);
      if (closed) return;
      await background.invalidate();
      if (closed) return;
      activeConfig = next.config;
      runtime = next;
      background.clearCompilation();
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
        background.schedule();
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
      background.schedule(background.compilation);
    } else await restart();
  };
  const queue = new WatchActionQueue(
    reportedWatchProcessor(
      scopedWatchWarnings(performAction, warnings),
      reporter,
      () => activeConfig.repoRoot,
    ),
    report,
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
  warnings.flush();
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
