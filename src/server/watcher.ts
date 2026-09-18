import chokidar, { type FSWatcher } from "chokidar";

import type { ResolvedConfig } from "../config/types.js";

import { PlainServeReporter } from "./reporter.js";
import {
  isPackageOwnedIgnoredWatchPath,
  watchTargets,
  type NotificationGate,
} from "./watch_events.js";
import {
  rawRenamePaths,
  ResourceWatchNotifications,
} from "./watch_notifications.js";

/** Build the source/config observer before compiling an accepted input graph. */
export function createSourceWatcher(
  factory: ConsumerWatcherFactory,
  config: ResolvedConfig,
  gate: NotificationGate<string>,
  report: (error: unknown) => void = (error) =>
    new PlainServeReporter().runtimeDiagnostic(error),
): ConsumerWatcher {
  const watcher = factory.create(watchTargets(config), (candidate) =>
    isPackageOwnedIgnoredWatchPath(candidate, config),
  );
  watcher.onChange((candidate) => gate.notify(candidate));
  watcher.onError(report);
  return watcher;
}

/** Consumer-input watcher lifecycle used by watched Serve. */
export interface ConsumerWatcher {
  close(): Promise<void>;
  onChange(callback: (path: string) => void): void;
  onError(callback: (error: Error) => void): void;
  ready(): Promise<void>;
}

/** Predicate used to prune package-owned paths from a recursive watch. */
export type WatchIgnorePredicate = (candidate: string) => boolean;

/** Filesystem traversal policy for a watcher with a confined set of inputs. */
export interface ConsumerWatchOptions {
  followSymlinks?: boolean;
}

/** Factory seam for watcher integration tests and alternate platforms. */
export interface ConsumerWatcherFactory {
  create(
    targets: readonly string[],
    ignore?: WatchIgnorePredicate,
    options?: ConsumerWatchOptions,
  ): ConsumerWatcher;
}

/** Chokidar-backed consumer watcher factory. */
export class ChokidarWatcherFactory implements ConsumerWatcherFactory {
  create(
    targets: readonly string[],
    ignore?: WatchIgnorePredicate,
    options?: ConsumerWatchOptions,
  ): ConsumerWatcher {
    return new ChokidarConsumerWatcher(
      chokidar.watch([...targets], {
        ...options,
        awaitWriteFinish: { pollInterval: 20, stabilityThreshold: 50 },
        ...(ignore ? { ignored: ignore } : {}),
        ignoreInitial: true,
      }),
      options?.followSymlinks === false,
      ignore,
    );
  }
}

class ChokidarConsumerWatcher implements ConsumerWatcher {
  readonly #notifications = new Set<ResourceWatchNotifications>();

  constructor(
    private readonly watcher: FSWatcher,
    private readonly observeEntryReplacements: boolean,
    private readonly ignore?: WatchIgnorePredicate,
  ) {}

  close(): Promise<void> {
    for (const notifications of this.#notifications) notifications.close();
    return this.watcher.close();
  }

  onChange(callback: (path: string) => void): void {
    if (!this.observeEntryReplacements) {
      this.watcher.on("all", (_event, candidate) => callback(candidate));
      return;
    }
    const notifications = new ResourceWatchNotifications(callback);
    this.#notifications.add(notifications);
    this.watcher.on("all", (_event, candidate) =>
      notifications.notify(candidate),
    );
    this.watcher.on(
      "raw",
      (event: string, candidate: string, details: unknown) => {
        if (event !== "rename") return;
        for (const path of rawRenamePaths(candidate, details, this.ignore))
          notifications.notify(path);
      },
    );
  }

  onError(callback: (error: Error) => void): void {
    this.watcher.on("error", (error) =>
      callback(error instanceof Error ? error : new Error(String(error))),
    );
  }

  ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.watcher.once("ready", resolve);
      this.watcher.once("error", reject);
    });
  }
}
