/** Watched Serve adopts lightweight generations; exhaustive work follows in the background. */
import { randomBytes } from "node:crypto";

import type { ComponentRuntime } from "../build/component_runtime.js";
import { prepareLiveRuntime } from "../build/live_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";

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
  createWatchedSupervisor,
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
import { watchTargets } from "./watch_paths.js";
import { reportedWatchProcessor } from "./watch_reporting.js";
import { WatchSetup } from "./watch_setup.js";
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
  let activeConfig = config;
  const resources = watches.resources;
  let runtime: ComponentRuntime;
  let signature: string;
  let supervisor: ProcessSupervisor | undefined;
  let port: number;
  try {
    const initial = (await watches.prepare(config))!;
    initial.adopt();
    await initial.close();
    runtime = await prepareLiveRuntime(watches.config);
    activeConfig = runtime.config;
    const inputs = (await watches.prepare(activeConfig, false))!;
    inputs.adopt(activeConfig);
    await inputs.close();
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
    await Promise.allSettled([watches.close(), supervisor?.close()]);
    throw error;
  }
  const running = supervisor;
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

  const reconfigure = async (candidate?: ResolvedConfig): Promise<void> => {
    const nextConfig =
      candidate ?? (await configLoader.load(activeConfig.configPath));
    let replacement = await watches.prepare(nextConfig, true, true);
    if (!replacement) return;
    try {
      if (closed) return;
      const next = await prepareLiveRuntime(replacement.config);
      replacement = await watches.refine(next.config, replacement);
      if (!replacement || closed) return;
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
      performAction,
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
