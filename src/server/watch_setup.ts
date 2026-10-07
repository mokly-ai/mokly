/** Shared source and authored-resource watch ownership for Build and Serve. */
import type { ResolvedConfig } from "../config/types.js";
import { bindTimings, timeAsync } from "../diagnostics/timings.js";

import { ResourceWatcher } from "./resource_watcher.js";
import { watcherReadyBeforeShutdown } from "./serve_lifecycle.js";
import {
  classifyWatchPath,
  NotificationGate,
  type RuntimeWatchAction,
  type WatchEvent,
} from "./watch_events.js";
import { hydrateWatchInventory } from "./watch_inventory.js";
import { watchTargets } from "./watch_paths.js";
import {
  createSourceWatcher,
  type ConsumerWatcher,
  type ConsumerWatcherFactory,
} from "./watcher.js";

/** A ready input observer; validation/publication remains with its caller. */
export interface PreparedSourceWatch {
  readonly config: ResolvedConfig;
  adopt(config?: ResolvedConfig): void;
  notify(event: WatchEvent): void;
  forwardTo(target: PreparedSourceWatch): void;
  close(): Promise<void>;
}

/** Buffer all startup sources and retain accepted watches until replacement. */
export class WatchSetup {
  readonly resources: ResourceWatcher;
  private readonly events: NotificationGate<WatchEvent>;
  private watcher: ConsumerWatcher | undefined;
  private targets: string | undefined;
  private closed = false;
  private readonly controller = new AbortController();

  constructor(
    private active: ResolvedConfig,
    private readonly factory: ConsumerWatcherFactory,
    private readonly shutdown: Promise<void>,
    private readonly report: (error: unknown) => void,
  ) {
    void shutdown.then(() => this.controller.abort());
    this.events = new NotificationGate(report);
    this.resources = new ResourceWatcher(
      factory,
      (event) => this.notify(event),
      report,
    );
  }

  get config(): ResolvedConfig {
    return this.active;
  }

  notify(event: WatchEvent): void {
    if (!this.closed) this.events.notify(event);
  }

  open(consumer: (event: WatchEvent) => void): void {
    this.events.open(
      bindTimings((event) => {
        if (!this.closed) consumer(event);
      }),
    );
  }

  classify(
    event: WatchEvent,
    additional: ReadonlySet<string> = new Set(),
  ): RuntimeWatchAction {
    return classifyWatchPath(
      event,
      this.active,
      new Set([...this.resources.paths, ...additional]),
    );
  }

  /** Resolve inventory before readiness; source changes alone do not publish output. */
  async prepare(
    config: ResolvedConfig,
    inventory = true,
    force = false,
  ): Promise<PreparedSourceWatch | undefined> {
    if (this.closed) return;
    const next = { ...config };
    if (inventory) {
      await hydrateWatchInventory(next, this.controller.signal);
      Object.assign(config, next);
    }
    if (this.closed) return;
    const targets = JSON.stringify(watchTargets(next));
    const gate = new NotificationGate<WatchEvent>(this.report);
    const forward = {
      notify: (event: WatchEvent) => gate.notify(event),
      forwardTo: (target: PreparedSourceWatch) =>
        gate.open((event) => target.notify(event)),
    };
    if (this.watcher && targets === this.targets && !force) {
      return {
        config: next,
        ...forward,
        adopt: (accepted = next) => {
          if (this.closed) return;
          this.active = accepted;
          gate.open((event) => this.notify(event));
        },
        close: async () => {},
      };
    }
    const watcher = createSourceWatcher(this.factory, next, gate, this.report);
    try {
      if (
        !(await timeAsync("watch.source-ready", () =>
          watcherReadyBeforeShutdown(watcher, this.shutdown),
        )) ||
        this.closed
      ) {
        await watcher.close();
        return;
      }
    } catch (error) {
      await watcher.close();
      throw error;
    }
    let adopted = false;
    let disposed = false;
    let previous: ConsumerWatcher | undefined;
    return {
      config: next,
      ...forward,
      adopt: (accepted = next) => {
        if (this.closed || adopted || disposed) return;
        previous = this.watcher;
        this.watcher = watcher;
        this.targets = targets;
        this.active = accepted;
        adopted = true;
        gate.open((event) => this.notify(event));
      },
      close: async () => {
        if (disposed) return;
        disposed = true;
        await (adopted ? previous : watcher)?.close();
      },
    };
  }

  /** Carry buffered candidate events when the rendered graph expands its inputs. */
  async refine(
    config: ResolvedConfig,
    previous?: PreparedSourceWatch,
  ): Promise<PreparedSourceWatch | undefined> {
    if (
      previous &&
      JSON.stringify(watchTargets(config)) ===
        JSON.stringify(watchTargets(previous.config))
    )
      return previous;
    const next = await this.prepare(config, false);
    if (previous) {
      if (next) previous.forwardTo(next);
      await previous.close();
    }
    return next;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.controller.abort();
    const results = await Promise.allSettled([
      this.watcher?.close(),
      this.resources.close(),
    ]);
    for (const result of results)
      if (result.status === "rejected") throw result.reason;
  }
}
