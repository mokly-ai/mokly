import type { Worker } from "node:worker_threads";

import { MoklyError, errorMessage, type MoklyErrorCode } from "../../errors.js";

/** Successful or typed failed response to one numbered worker request. */
export interface WorkerResponse<Result> {
  readonly id: number;
  readonly result?: Result;
  readonly error?: { readonly code: MoklyErrorCode; readonly message: string };
}

type Pending<Result> =
  | {
      readonly kind: "ready";
      readonly resolve: () => void;
      readonly reject: (error: Error) => void;
    }
  | {
      readonly kind: "request";
      readonly resolve: (value: Result) => void;
      readonly reject: (error: Error) => void;
    };

/** Permanently fail all requests when a worker dies outside requested close. */
export class WorkerRequests<Result> {
  private readonly pending = new Map<number, Pending<Result>>();
  private readonly ready: Promise<void>;
  private nextId = 1;
  private failure: MoklyError | undefined;
  private closing = false;
  private closePromise: Promise<void> | undefined;

  constructor(
    private readonly worker: Worker,
    private readonly module: string,
  ) {
    this.ready = new Promise<void>((resolve, reject) => {
      this.pending.set(0, { kind: "ready", resolve, reject });
    });
    worker.on("message", (message: WorkerResponse<Result>) =>
      this.receive(message),
    );
    worker.on("error", (error: Error) =>
      this.fail(`error: ${errorMessage(error)}`),
    );
    worker.on("messageerror", (error: unknown) =>
      this.fail(`messageerror: ${errorMessage(error)}`),
    );
    worker.on("exit", (code: number) => this.fail(`exit code ${code}`));
  }

  /** Wait for module evaluation or fail promptly after worker death. */
  async start(): Promise<void> {
    await this.ready;
  }

  /** Send one numbered request, retaining no pending promise after failure. */
  async request(message: Readonly<Record<string, unknown>>): Promise<Result> {
    await this.ready;
    if (this.failure) throw this.failure;
    const id = this.nextId++;
    return new Promise<Result>((resolve, reject) => {
      this.pending.set(id, { kind: "request", resolve, reject });
      try {
        this.worker.postMessage({ ...message, id });
      } catch (error) {
        this.fail(`error: ${errorMessage(error)}`);
      }
    });
  }

  /** Stop this worker by request without misclassifying its exit. */
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.rejectPending(
      this.failure ??
        new MoklyError(
          "build-invalid",
          `PostCSS worker for ${this.module} is closed; rebuild the catalogue`,
        ),
    );
    this.closePromise = this.worker.terminate().then(() => {});
    return this.closePromise;
  }

  private receive(message: WorkerResponse<Result>): void {
    const pending = this.pending.get(message.id);
    if (!pending || this.failure || this.closing) return;
    this.pending.delete(message.id);
    if (message.error) {
      const prefix = `[mokly/${message.error.code}] `;
      pending.reject(
        new MoklyError(
          message.error.code,
          message.error.message.startsWith(prefix)
            ? message.error.message.slice(prefix.length)
            : message.error.message,
        ),
      );
    } else if (pending.kind === "ready") pending.resolve();
    else if (message.result !== undefined) pending.resolve(message.result);
    else this.fail("invalid response");
  }

  private fail(reason: string): void {
    if (this.failure || this.closing) return;
    this.failure = new MoklyError(
      "build-invalid",
      `PostCSS worker for ${this.module} stopped unexpectedly (${reason}); check the plugin and rebuild`,
    );
    this.rejectPending(this.failure);
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
