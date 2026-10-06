/** Transactional watches for resources discovered from generated output. */

import path from "node:path";

import type { Compilation } from "../build/compile.js";
import { isInside } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";

import { watcherReadyBeforeShutdown } from "./serve_lifecycle.js";
import { NotificationGate, type WatchEvent } from "./watch_events.js";
import {
  discoverWatchResources,
  type ResourceWatchSnapshot,
} from "./watch_resources.js";
import type { ConsumerWatcher, ConsumerWatcherFactory } from "./watcher.js";

/** Ready resource inputs adopted only after the matching output succeeds. */
export interface PreparedResourceWatch {
  adopt(): void;
  close(): Promise<void>;
}

/** Retain last-good watches until a complete replacement is ready. */
export class ResourceWatcher {
  #snapshot: ResourceWatchSnapshot | undefined;
  #watcher: ConsumerWatcher | undefined;
  #closed = false;

  constructor(
    private readonly factory: ConsumerWatcherFactory,
    private readonly changed: (event: WatchEvent) => void,
    private readonly failed: (error: Error) => void,
  ) {}

  get paths(): ReadonlySet<string> {
    return this.#snapshot?.paths ?? new Set();
  }

  /** Observe new inputs before adoption and retain removed inputs until it succeeds. */
  async prepare(
    config: ResolvedConfig,
    compilation: Pick<Compilation, "outputs">,
    shutdownStarted: Promise<void>,
    allowInvalid = false,
    incremental = false,
  ): Promise<PreparedResourceWatch | undefined> {
    const previous = incremental ? this.#snapshot : undefined;
    const discover = async (last?: ResourceWatchSnapshot) => {
      const next = await discoverWatchResources(
        config,
        compilation,
        last,
        allowInvalid,
      );
      return previous ? mergeResourceSnapshots(previous, next) : next;
    };
    let snapshot = await timeAsync("watch.resources-discover", () =>
      discover(this.#snapshot),
    );
    if (sameWatch(snapshot, this.#snapshot)) {
      return {
        adopt: () => {
          if (!this.#closed) this.#snapshot = snapshot;
        },
        close: async () => undefined,
      };
    }
    while (!this.#closed) {
      const gate = new NotificationGate<WatchEvent>((error) =>
        this.failed(error instanceof Error ? error : new Error(String(error))),
      );
      const paths = snapshot.paths;
      const watcher =
        snapshot.paths.size > 0
          ? this.factory.create(
              [
                ...new Set(
                  [...paths].map((candidate) => path.dirname(candidate)),
                ),
              ].sort(),
              (candidate) =>
                ![...paths].some((resource) =>
                  isInside(path.resolve(candidate), resource),
                ),
              { followSymlinks: false },
            )
          : undefined;
      watcher?.onChange((event) => gate.notify(event));
      watcher?.onError(this.failed);
      try {
        if (
          watcher &&
          !(await timeAsync("watch.resources-ready", () =>
            watcherReadyBeforeShutdown(watcher, shutdownStarted),
          ))
        ) {
          await watcher.close();
          return undefined;
        }
        const refreshed = await timeAsync("watch.resources-rediscover", () =>
          discover(snapshot),
        );
        if (!sameWatch(snapshot, refreshed)) {
          await watcher?.close();
          snapshot = refreshed;
          continue;
        }
        snapshot = refreshed;
        let adopted = false;
        let disposed = false;
        let previous: ConsumerWatcher | undefined;
        return {
          adopt: () => {
            if (this.#closed || adopted || disposed) return;
            previous = this.#watcher;
            this.#snapshot = snapshot;
            this.#watcher = watcher;
            adopted = true;
            gate.open((event) => {
              if (this.#watcher === watcher && !this.#closed)
                this.changed(event);
            });
          },
          close: async () => {
            if (disposed) return;
            disposed = true;
            await (adopted ? previous : watcher)?.close();
          },
        };
      } catch (error) {
        await watcher?.close();
        throw error;
      }
    }
    return undefined;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#watcher?.close();
  }
}

function mergeResourceSnapshots(
  previous: ResourceWatchSnapshot,
  next: ResourceWatchSnapshot,
): ResourceWatchSnapshot {
  return {
    paths: new Set([...previous.paths, ...next.paths]),
    invalid: new Set([...previous.invalid, ...next.invalid]),
    references: new Map([...previous.references, ...next.references]),
    locations: new Map([...previous.locations, ...next.locations]),
  };
}

/** Replace observers after invalid entries recover, even at the same lexical path. */
function sameWatch(
  left: ResourceWatchSnapshot,
  right?: ResourceWatchSnapshot,
): boolean {
  return (
    samePaths(left.paths, right?.paths ?? new Set()) &&
    samePaths(left.invalid, right?.invalid ?? new Set())
  );
}

function samePaths(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  return (
    left.size === right.size &&
    [...left].every((candidate) => right.has(candidate))
  );
}
