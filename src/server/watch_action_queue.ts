/** Serialized watch work with progress spanning queued and active actions. */

import {
  WATCH_ACTION_PRIORITY,
  type RuntimeWatchAction,
} from "./watch_events.js";

/** Queue-level progress observer covering qualifying queued and running work. */
export interface WatchActionQueueObserver {
  setUpdating(updating: boolean): void;
}

/** Serialize watch work and coalesce changes received during active work. */
export class WatchActionQueue {
  readonly #pending = new Set<RuntimeWatchAction>();
  readonly #paths = new Set<string>();
  #closed = false;
  #draining: Promise<void> | undefined;
  #active: RuntimeWatchAction | undefined;
  #updating = false;

  constructor(
    private readonly process: (
      action: RuntimeWatchAction,
      paths: readonly string[],
    ) => Promise<void>,
    private readonly reportError: (error: unknown) => void,
    private readonly observer?: WatchActionQueueObserver,
  ) {}

  /** Queue one action; a stronger pending action subsumes weaker actions. */
  notify(action: RuntimeWatchAction, paths: readonly string[] = []): void {
    if (this.#closed || action === "ignore") return;
    this.#pending.add(action);
    for (const candidate of paths) this.#paths.add(candidate);
    this.syncProgress();
    if (!this.#draining) this.#draining = this.drain();
  }

  /** Wait until all currently queued work has completed. */
  async settled(): Promise<void> {
    while (this.#draining) await this.#draining;
  }

  /** Discard pending work and wait for the active operation to finish. */
  async close(): Promise<void> {
    this.#closed = true;
    this.#pending.clear();
    this.#paths.clear();
    this.syncProgress();
    await this.#draining;
  }

  private async drain(): Promise<void> {
    try {
      while (!this.#closed && this.#pending.size > 0) {
        const action = WATCH_ACTION_PRIORITY.find((candidate) =>
          this.#pending.has(candidate),
        );
        const paths = [...this.#paths];
        this.#pending.clear();
        this.#paths.clear();
        if (!action || action === "ignore") continue;
        this.#active = action;
        this.syncProgress();
        try {
          await this.process(action, paths);
        } catch (error) {
          this.reportError(error);
        } finally {
          this.#active = undefined;
          this.syncProgress();
        }
      }
    } finally {
      this.#draining = undefined;
      if (!this.#closed && this.#pending.size > 0) {
        this.#draining = this.drain();
      }
    }
  }

  private syncProgress(): void {
    const updating = [this.#active, ...this.#pending].some(
      (action) =>
        action === "reconfigure" ||
        action === "rebuild" ||
        action === "restart" ||
        action === "reload",
    );
    if (updating === this.#updating) return;
    this.#updating = updating;
    this.observer?.setUpdating(updating);
  }
}
