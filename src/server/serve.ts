import type { BaselineBuilder } from "../baseline/types.js";
import { prepareLiveRuntime } from "../build/live_runtime.js";
import {
  FileSystemGeneratedOutputStore,
  type GeneratedOutputStore,
} from "../build/output_store.js";
import { FileSystemConfigLoader, type ConfigLoader } from "../config/load.js";
import type { ResolvedConfig } from "../config/types.js";

import {
  RepositoryCatalogueChangeClassifier,
  type CatalogueChangeClassifier,
} from "./component_changes.js";
import { configuredServedReview } from "./configured_review.js";
import { BackgroundGeneration } from "./demand/generation.js";
import {
  NodeCatalogueServerFactory,
  type CatalogueServerFactory,
} from "./factory.js";
import { PlainServeReporter, type ServeReporter } from "./reporter.js";
import { ServedReviewRepository } from "./review_repository.js";
import { serveWatched } from "./serve_watched.js";
import {
  NodeProcessSupervisorFactory,
  type ProcessSupervisorFactory,
} from "./supervisor.js";
import {
  ChokidarWatcherFactory,
  type ConsumerWatcherFactory,
} from "./watcher.js";

/** Public Serve options after CLI validation. */
export interface ServeOptions {
  base?: string;
  port: number;
  watch: boolean;
}

/** Closable Serve lifecycle returned to CLI and integration tests. */
export interface RunningServe {
  close(): Promise<void>;
  port: number;
  /** Enqueue the same serialized source rebuild used by watched edits. */
  rebuild?(): void;
  url: string;
}

/** Injectable runtime collaborators for Serve orchestration. */
export interface ServeDependencies {
  /** Derived-mode rebuilds; Serve constructs the Node builder when absent. */
  baselineBuilder?: BaselineBuilder;
  changeClassifier?: CatalogueChangeClassifier;
  configLoader: ConfigLoader;
  outputStore: GeneratedOutputStore;
  processSupervisorFactory: ProcessSupervisorFactory;
  reporter?: ServeReporter;
  serverFactory: CatalogueServerFactory;
  watcherFactory: ConsumerWatcherFactory;
}

const DEFAULT_CHANGE_CLASSIFIER = new RepositoryCatalogueChangeClassifier();
const DEFAULT_DEPENDENCIES: ServeDependencies = {
  changeClassifier: DEFAULT_CHANGE_CLASSIFIER,
  configLoader: new FileSystemConfigLoader(),
  outputStore: new FileSystemGeneratedOutputStore(),
  processSupervisorFactory: new NodeProcessSupervisorFactory(),
  reporter: new PlainServeReporter(),
  serverFactory: new NodeCatalogueServerFactory(),
  watcherFactory: new ChokidarWatcherFactory(),
};

/** Build a last-good snapshot and start watched or deterministic Browse. */
export async function serve(
  config: ResolvedConfig,
  options: ServeOptions,
  provided: Partial<ServeDependencies> = {},
): Promise<RunningServe> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...provided };
  const reporter = dependencies.reporter ?? DEFAULT_DEPENDENCIES.reporter!;
  if (!options.watch) {
    const generationStartedAt = Date.now();
    let changesStartedAt = generationStartedAt;
    let baselineStartedAt = generationStartedAt;
    const runtime = await prepareLiveRuntime(config);
    config = runtime.config;
    const base = options.base ?? config.review.base;
    const repository = new ServedReviewRepository(config);
    const background = new BackgroundGeneration(
      dependencies.outputStore,
      dependencies.changeClassifier ?? DEFAULT_CHANGE_CLASSIFIER,
      (compilation, accepted) => {
        changesStartedAt = Date.now();
        reporter.catalogueReady(
          compilation.manifest,
          changesStartedAt - generationStartedAt,
        );
        server.completeCatalogue?.(compilation.manifest, accepted.generation);
        server.publishUpdate({ kind: "evidence" });
      },
      (snapshot) => {
        const duration = Date.now() - changesStartedAt;
        if (snapshot)
          reporter.changesReady(snapshot.changedRoutes?.length ?? 0, duration);
        else reporter.changesUnavailable(duration);
        server.publishUpdate({
          kind: "evidence",
          changedRoutes: snapshot?.changedRoutes ?? null,
          componentChanges: snapshot ?? null,
          changesStatus: snapshot ? "ready" : "unavailable",
        });
      },
      {
        baselinePrepared: (commit) => {
          repository.accept(commit);
          server.publishUpdate({
            kind: "evidence",
            ...(commit === null ? { changesStatus: "pending" } : {}),
          });
        },
        baselineStatus: (changesStatus) =>
          server.publishUpdate({ kind: "evidence", changesStatus }),
        baselineProgress: (event) => {
          if (event.type === "start") {
            baselineStartedAt = Date.now();
            reporter.baselinePreparing(base);
          }
          if (event.type === "complete")
            reporter.baselineReady(
              event.commit,
              event.cacheHit,
              Date.now() - baselineStartedAt,
            );
        },
        diagnostic: (error) => reporter.runtimeDiagnostic(error),
        ...(dependencies.baselineBuilder
          ? { builder: dependencies.baselineBuilder }
          : {}),
      },
    );
    const server = await dependencies.serverFactory.start(config, {
      base,
      changesStatus: "pending",
      onForeground: (active) => background.foreground(active),
      manifest: runtime.manifest,
      componentRuntime: runtime,
      port: options.port,
      review: configuredServedReview(config, base, repository),
      onDiagnostic: (error) => reporter.runtimeDiagnostic(error),
    });
    background.start(runtime, base);
    return {
      port: server.port,
      url: server.url,
      async close() {
        await background.close();
        await server.close();
      },
    };
  }
  return serveWatched(config, options, dependencies);
}
