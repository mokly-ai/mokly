/** Typed watched-action dispatch and accepted-runtime delivery. */

import { randomBytes } from "node:crypto";

import type { Compilation } from "../build/compile.js";
import type { ComponentRuntime } from "../build/component_runtime.js";

import { restartWithRecovery } from "./serve_lifecycle.js";
import type { ProcessSupervisor } from "./supervisor.js";
import {
  completedWatchAction,
  deliveryPhaseWatchAction,
  sourcePhaseWatchAction,
  type WatchActionDelivery,
  type WatchActionOutcome,
} from "./watch_action_outcome.js";
import type { RuntimeWatchAction } from "./watch_events.js";

type DeliveryWatchAction = Exclude<
  RuntimeWatchAction,
  "ignore" | "rebuild" | "reconfigure"
>;

/** Background operations required after a runtime is accepted. */
export interface WatchDeliveryBackground {
  readonly changesStatus: "pending" | "preparing";
  readonly compilation: Compilation | undefined;
  invalidate(): Promise<void>;
  schedule(existing?: Compilation): void;
}

/** Mutable accepted runtime owned by watched Serve. */
export interface WatchDeliveryRuntime {
  current(): ComponentRuntime;
  replace(runtime: ComponentRuntime): void;
}

/** Delivery operations shared by source updates and delivery-only actions. */
export interface WatchRuntimeDelivery {
  process(action: DeliveryWatchAction): Promise<void>;
  restart(version?: number): Promise<void>;
}

/** Serialized watched-action processor consumed by the reporting boundary. */
export interface WatchActionProcessor {
  process(action: RuntimeWatchAction): Promise<WatchActionOutcome>;
}

interface RuntimeDeliveryOptions {
  readonly background: WatchDeliveryBackground;
  readonly isClosed: () => boolean;
  readonly running: ProcessSupervisor;
  readonly runtime: WatchDeliveryRuntime;
}

/** Deliver accepted runtimes and delivery-only actions through the child. */
export class WatchedRuntimeDelivery implements WatchRuntimeDelivery {
  constructor(private readonly options: RuntimeDeliveryOptions) {}

  async restart(version?: number): Promise<void> {
    const { background, running } = this.options;
    try {
      await restartWithRecovery(running, version);
      running.notifyUpdate(
        undefined,
        undefined,
        background.changesStatus,
        "evidence",
      );
    } finally {
      if (!this.options.isClosed()) background.schedule(background.compilation);
    }
  }

  async process(action: DeliveryWatchAction): Promise<void> {
    const { background, running, runtime } = this.options;
    if (action === "evidence") {
      if (!background.compilation) return;
      await background.invalidate();
      if (this.options.isClosed()) return;
      running.notifyUpdate(
        undefined,
        undefined,
        background.changesStatus,
        "evidence",
      );
      background.schedule(background.compilation);
      return;
    }
    await background.invalidate();
    if (this.options.isClosed()) return;
    const next = {
      ...runtime.current(),
      generation: randomBytes(16).toString("hex"),
    };
    runtime.replace(next);
    running.replaceComponentRuntime(
      next,
      action === "reload" ? "live" : "stage",
      action === "reload" ? running.reserveUpdateVersion() : undefined,
      action === "reload" ? background.changesStatus : undefined,
    );
    if (action === "reload") background.schedule(background.compilation);
    else await this.restart();
  }
}

interface PhasedProcessorOptions {
  readonly delivery: WatchRuntimeDelivery;
  readonly isClosed: () => boolean;
  readonly rebuild: () => Promise<WatchActionDelivery | undefined>;
  readonly reconfigure: () => Promise<WatchActionDelivery | undefined>;
}

/** Select source or delivery handling without inferring a phase from failure text. */
export class PhasedWatchActionProcessor implements WatchActionProcessor {
  constructor(private readonly options: PhasedProcessorOptions) {}

  process(action: RuntimeWatchAction): Promise<WatchActionOutcome> {
    if (this.options.isClosed() || action === "ignore")
      return Promise.resolve(completedWatchAction);
    if (action === "reconfigure")
      return sourcePhaseWatchAction(this.options.reconfigure);
    if (action === "rebuild")
      return sourcePhaseWatchAction(this.options.rebuild);
    return deliveryPhaseWatchAction(() =>
      this.options.delivery.process(action),
    );
  }
}
