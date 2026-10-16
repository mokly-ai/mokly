/** The live descriptor of Serve: the render capability of one generation. */

import type { LiveDescriptorV3 } from "../catalogue/types.js";
import { MoklyVersionError } from "../catalogue/version_error.js";

import type { ShellLiveSource } from "./data_source.js";

/** Live prop editing in Serve: its descriptor is installed, loading, or failed. */
export type LiveEditingStatus = "ready" | "preparing" | "failed";

/** What the descriptor asks of the controller that owns it. */
export interface LiveDescriptorHost {
  /** The installed index's render generation. */
  generation(): string | undefined;
  /** The installed descriptor or the editing status changed. */
  changed(): void;
  versionError(error: MoklyVersionError): void;
  warn(message: string, cause?: unknown): void;
}

/**
 * Load the descriptor of the installed render generation, one load at a time.
 * A refetch keeps the installed descriptor until its replacement installs;
 * after a failed load, or one that brought another generation, a retry or
 * the next message loads it again.
 */
export class LiveDescriptor {
  readonly #host: LiveDescriptorHost;
  readonly #live: ShellLiveSource | undefined;
  #installed: LiveDescriptorV3 | undefined;
  #load: AbortController | undefined;
  #failed: "error" | "generation" | undefined;

  constructor(live: ShellLiveSource | undefined, host: LiveDescriptorHost) {
    this.#live = live;
    this.#host = host;
  }

  get installed(): LiveDescriptorV3 | undefined {
    return this.#installed;
  }

  /** Ready while a descriptor is installed; failed only without one. */
  get status(): LiveEditingStatus {
    if (this.#installed) return "ready";
    return this.#failed === "error" ? "failed" : "preparing";
  }

  /** The last load failed or brought another generation. */
  get failed(): boolean {
    return this.#failed !== undefined;
  }

  /** Load again after a failure; a load in flight continues. */
  retry(): void {
    if (!this.#load) this.load();
  }

  /** Load the descriptor of the installed generation; abort an older load. */
  load(): void {
    const generation = this.#host.generation();
    this.#load?.abort();
    this.#load = undefined;
    const failed = this.#failed;
    this.#failed = undefined;
    if (!this.#live || !generation) {
      this.stop();
      return;
    }
    if (failed) this.#host.changed();
    const controller = new AbortController();
    this.#load = controller;
    void this.#live.loadDescriptor(controller.signal).then(
      (descriptor) => {
        if (controller.signal.aborted) return;
        this.#load = undefined;
        if (descriptor.generation !== this.#host.generation()) {
          this.#failed = "generation";
          return;
        }
        this.#installed = descriptor;
        this.#host.changed();
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        this.#load = undefined;
        if (error instanceof MoklyVersionError) {
          this.#host.versionError(error);
          return;
        }
        this.#failed = "error";
        this.#host.warn("Live prop editing is unavailable.", error);
        this.#host.changed();
      },
    );
  }

  /** Abort the load and drop the installed descriptor. */
  stop(): void {
    this.#load?.abort();
    this.#load = undefined;
    if (!this.#installed) return;
    this.#installed = undefined;
    this.#host.changed();
  }
}
