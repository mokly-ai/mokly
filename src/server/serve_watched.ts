/** Watched Serve adopts lightweight generations; exhaustive work follows in the background. */
import { randomBytes } from "node:crypto";

import type { ComponentRuntime } from "../build/component_runtime.js";
import { prepareLiveRuntime } from "../build/live_runtime.js";
import type { ResolvedConfig } from "../config/types.js";

import { RepositoryCatalogueChangeClassifier } from "./component_changes.js";
import {
  GitReferenceObserver,
  RepositoryGitReferences,
} from "./demand/git_references.js";
import { PreviewResources } from "./demand/resources.js";
import { PlainServeReporter } from "./reporter.js";
import type { RunningServe, ServeDependencies, ServeOptions } from "./serve.js";
import {
  closeWatched,
  startWatchedSupervisor,
  restartWatchedGeneration,
} from "./serve_lifecycle.js";
import type { ProcessSupervisor } from "./supervisor.js";
import {
  NotificationGate,
  type RuntimeWatchAction,
  WatchActionQueue,
  WatchDebouncer,
  type WatchEvent,
} from "./watch_events.js";
import { sourceTargetsChanged } from "./watch_preparation.js";
import { reportedWatchProcessor } from "./watch_reporting.js";
import { WatchSetup } from "./watch_setup.js";
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
  const classifier =
    dependencies.changeClassifier ?? new RepositoryCatalogueChangeClassifier();
  let closed = false;
  let signalShutdown: () => void = () => {};
  const shutdown = new Promise<void>((resolve) => {
    signalShutdown = resolve;
  });
  const report = (error: unknown) => reporter.runtimeDiagnostic(error);
  const failures = new NotificationGate<Error>(report);
  const watches = new WatchSetup(config, watcherFactory, shutdown, report);
  const resources = watches.resources;
  let runtime: ComponentRuntime;
  let running: ProcessSupervisor;
  let port: number;
  try {
    const prepared = (await watches.prepareRuntime(
      config,
      warnings.forGeneration(),
      warnings.generation,
      true,
    ))!;
    runtime = prepared.runtime;
    prepared.source.adopt(runtime.config);
    await prepared.source.close();
    const started = await startWatchedSupervisor(
      runtime.config,
      options,
      processSupervisorFactory,
      runtime,
      failures,
      (event) => warnings.addGeneration(event),
      watches,
      resources,
    );
    running = started.running;
    port = started.port;
  } catch (error) {
    await watches.close();
    throw error;
  }
  let activeConfig = runtime.config;
  let signature = JSON.stringify(runtime.manifest);
  running.onDiagnostic?.((message) => reporter.runtimeDiagnostic(message));
  const previews = new PreviewResources(
    watcherFactory,
    (event) => watches.notify(event),
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
    writeOutput: options.build ?? false,
    ...(options.invocationDirectory
      ? { invocationDirectory: options.invocationDirectory }
      : {}),
  });
  running.onForeground?.((active) => background.foreground(active));
  const notify = (event: WatchEvent) => {
    const action = watches.classify(event, previews.paths);
    debouncer.notify(action, event.path);
  };

  const restart = () =>
    restartWatchedGeneration(running, background, () => closed);

  const reconfigure = async (
    generation: string,
    candidate?: ResolvedConfig,
  ): Promise<void> => {
    const warn = warnings.forGeneration(generation);
    const nextConfig =
      candidate ?? (await configLoader.load(activeConfig.configPath, warn));
    const prepared = await watches.prepareRuntime(nextConfig, warn, generation);
    if (!prepared) return;
    const replacement = prepared.source;
    const next = prepared.runtime;
    try {
      if (closed) return;
      await background.invalidate(next.config);
      if (closed) return;
      activeConfig = next.config;
      runtime = next;
      background.clearCompilation();
      references.replace(
        activeConfig.repoRoot,
        options.base ?? activeConfig.review.base,
      );
      signature = JSON.stringify(next.manifest);
      running.replaceComponentRuntime(next, "stage");
      if (!candidate) running.discardCheckedClosure?.();
      replacement.adopt(activeConfig);
      try {
        await replacement.close();
      } finally {
        if (!closed) await restart();
      }
    } finally {
      await replacement?.close();
    }
  };

  const performAction = async (action: RuntimeWatchAction): Promise<void> => {
    if (closed) return;
    const generation = warnings.generation;
    if (action === "reconfigure") return reconfigure(generation);
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
        warnings.forGeneration(generation),
        generation,
      );
      if (sourceTargetsChanged(activeConfig, next.config))
        return reconfigure(generation, next.config);
      if (closed) return;
      await background.invalidate();
      if (closed) return;
      activeConfig = next.config;
      const inputs = (await watches.prepare(activeConfig, false))!;
      inputs.adopt(activeConfig);
      await inputs.close();
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
      background.schedule(background.compilation, true);
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
  const debouncer = new WatchDebouncer(
    () => activeConfig.watch.debounceMs,
    (action, paths) => queue.notify(action, paths),
  );
  failures.open((error) => {
    if (!closed) {
      report(error);
      queue.notify("restart");
    }
  });
  watches.open(notify);
  background.schedule();
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
      debouncer.close();
      await references.close();
      await background.close();
      await previews.close();
      await closeWatched(queue, watches, running);
    },
  };
}
