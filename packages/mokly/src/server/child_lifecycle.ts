/** One child owns readiness, terminal observation and an idempotent cleanup operation. */

import { MoklyError, errorMessage } from "../errors.js";

import type { ChildHandle } from "./child_process.js";
import type { ChildCommand } from "./update_messages.js";

/** Time allowed for each watched-child shutdown stage. */
export interface ChildShutdownTimings {
  gracefulMilliseconds: number;
  terminateMilliseconds: number;
}

const DEFAULT_TIMINGS: ChildShutdownTimings = {
  gracefulMilliseconds: 2_000,
  terminateMilliseconds: 2_000,
};
const READINESS_TIMEOUT_MILLISECONDS = 300_000;

/** Retain a child until its terminal event, even when readiness or IPC fails. */
export class ManagedChild {
  readonly ready: Promise<number>;
  readonly #exit: Promise<void>;
  #resolveReady: (port: number) => void = () => undefined;
  #rejectReady: (error: Error) => void = () => undefined;
  #resolveExit: () => void = () => undefined;
  #state: "waiting" | "ready" | "stopping" | "exited" = "waiting";
  #failure: MoklyError | undefined;
  readonly #messages: Array<(message: unknown) => void> = [];
  #cleanup: Promise<void> | undefined;
  #readinessTimer: ReturnType<typeof setTimeout> | undefined;
  #terminateTimer: ReturnType<typeof setTimeout> | undefined;
  #forceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly handle: ChildHandle,
    private readonly onUnexpectedFailure: (error: Error) => void,
    private readonly timings: ChildShutdownTimings = DEFAULT_TIMINGS,
  ) {
    this.ready = new Promise((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    this.#exit = new Promise((resolve) => {
      this.#resolveExit = resolve;
    });
    this.#readinessTimer = setTimeout(() => {
      this.fail(new Error("server child readiness timed out"));
    }, READINESS_TIMEOUT_MILLISECONDS);
    this.#readinessTimer.unref();
    handle.onExit((code) => this.didExit(code));
    handle.onError((error) => this.fail(error));
    handle.onDisconnect(() => this.didDisconnect());
    handle.onMessage((message) => {
      if (this.#state === "waiting" && isReady(message)) {
        this.#state = "ready";
        clearTimeout(this.#readinessTimer);
        this.#resolveReady(message.port);
      }
      if (this.#state === "waiting" || this.#state === "ready")
        for (const callback of this.#messages) callback(message);
    });
  }

  /** Confirmed terminal state, never inferred from sending a signal. */
  get exited(): boolean {
    return this.#state === "exited";
  }
  /** Cleanup has started and updates/readiness must no longer be accepted. */
  get stopping(): boolean {
    return this.#cleanup !== undefined;
  }
  /** First failure, retained through subsequent shutdown errors. */
  get failure(): MoklyError | undefined {
    return this.#failure;
  }

  /** Observe messages while this lifecycle still owns a starting or ready child. */
  onMessage(callback: (message: unknown) => void): void {
    this.#messages.push(callback);
  }

  /** Deliver the startup graph before readiness; other updates require a ready child. */
  send(message: ChildCommand): void {
    if (
      this.#state !== "ready" &&
      !(
        this.#state === "waiting" &&
        (message.type === "component-runtime-startup" ||
          message.type === "component-runtime")
      )
    )
      return;
    try {
      this.handle.send(message);
    } catch (error) {
      this.fail(error);
    }
  }

  /** Every caller waits on the same terminal promise and escalation timers. */
  close(): Promise<void> {
    if (this.#cleanup) return this.#cleanup;
    this.#cleanup = this.#exit;
    if (this.exited) return this.#cleanup;
    if (this.#state === "waiting") {
      this.#failure ??= serverFailure(
        new Error("server child closed before readiness"),
      );
      this.#rejectReady(this.#failure);
    }
    this.#state = "stopping";
    clearTimeout(this.#readinessTimer);
    this.#terminateTimer = setTimeout(() => {
      this.attemptShutdown(() => this.handle.terminate());
      if (this.exited) return;
      this.#forceTimer = setTimeout(() => {
        if (!this.exited) this.attemptShutdown(() => this.handle.forceKill());
      }, this.timings.terminateMilliseconds);
      this.#forceTimer.unref();
    }, this.timings.gracefulMilliseconds);
    this.#terminateTimer.unref();
    this.attemptShutdown(() => this.handle.send({ type: "shutdown" }));
    return this.#cleanup;
  }

  /** Expected shutdown may close IPC before the process finishes; keep awaiting exit. */
  private didDisconnect(): void {
    if (this.#state === "waiting" || this.#state === "ready")
      this.fail(new Error("server child IPC disconnected"));
  }

  private fail(error: unknown): void {
    if (this.exited) return;
    this.#failure ??= serverFailure(error);
    const state = this.#state;
    if (state === "stopping") return;
    if (state === "waiting") this.#rejectReady(this.#failure);
    void this.close();
    if (state === "ready") this.onUnexpectedFailure(this.#failure);
  }

  private didExit(code: number | null): void {
    if (this.exited) return;
    const state = this.#state;
    this.#state = "exited";
    clearTimeout(this.#readinessTimer);
    clearTimeout(this.#terminateTimer);
    clearTimeout(this.#forceTimer);
    this.#resolveExit();
    if (state === "stopping") return;
    this.#failure ??= serverFailure(
      new Error(
        `server child exited ${state === "waiting" ? "before readiness" : "unexpectedly"} (${String(code)})`,
      ),
    );
    if (state === "waiting") this.#rejectReady(this.#failure);
    else this.onUnexpectedFailure(this.#failure);
  }

  /** Broken IPC or a failed signal cannot skip later cleanup stages or release ownership. */
  private attemptShutdown(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.#failure ??= serverFailure(error);
    }
  }
}

function serverFailure(error: unknown): MoklyError {
  return new MoklyError("server-failed", errorMessage(error), {
    cause: error,
  });
}

function isReady(message: unknown): message is { port: number; type: "ready" } {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "ready" &&
    Number.isInteger((message as { port?: unknown }).port)
  );
}
