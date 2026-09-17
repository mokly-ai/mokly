/** One active job, eight queued pages, latest request per page, bounded termination. */
import {
  ComponentRenderError,
  type ComponentRenderRequest,
} from "@mokly/viewer/data";

import type { TransientRender } from "./transient_assets.js";
import type { RenderWorker, RenderWorkerFactory } from "./worker_client.js";

interface Job {
  request: ComponentRenderRequest;
  controller: AbortController;
  resolve(value: TransientRender): void;
  reject(error: unknown): void;
}
export class RenderQueue {
  private readonly pending: Job[] = [];
  private active: Job | undefined;
  private worker: RenderWorker | undefined;
  private draining: Promise<void> | undefined;
  private closed = false;
  constructor(
    private readonly factory: RenderWorkerFactory,
    private readonly timeoutMs = 10_000,
  ) {}

  render(
    request: ComponentRenderRequest,
    signal: AbortSignal,
  ): Promise<TransientRender> {
    if (this.closed || signal.aborted) return Promise.reject(cancelled());
    for (const job of this.pending.filter(
      (job) => job.request.pageId === request.pageId,
    ))
      job.controller.abort();
    if (this.active?.request.pageId === request.pageId)
      this.active.controller.abort();
    if (this.pending.length >= 8)
      return Promise.reject(
        new ComponentRenderError(
          "capacity",
          "The renderer is busy. Try again shortly.",
        ),
      );
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      const cleanup = () => signal.removeEventListener("abort", abort);
      const job: Job = {
        request,
        controller,
        resolve: (value) => {
          cleanup();
          resolve(value);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
      };
      controller.signal.addEventListener(
        "abort",
        () => {
          const index = this.pending.indexOf(job);
          if (index >= 0) {
            this.pending.splice(index, 1);
            job.reject(cancelled());
          }
        },
        { once: true },
      );
      signal.addEventListener("abort", abort, { once: true });
      this.pending.push(job);
      this.start();
    });
  }
  async close(): Promise<void> {
    this.closed = true;
    for (const job of [...this.pending]) job.controller.abort();
    this.active?.controller.abort();
    await this.draining;
    await this.worker?.close();
    this.worker = undefined;
  }
  private start(): void {
    this.draining ??= this.drain().finally(() => {
      this.draining = undefined;
      if (!this.closed && this.pending.length) this.start();
    });
  }
  private async drain(): Promise<void> {
    while (!this.closed && this.pending.length) {
      const job = this.pending.shift()!;
      this.active = job;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort = () => {};
      try {
        this.worker ??= this.factory.create();
        const interrupted = new Promise<never>((_resolve, reject) => {
          abort = () => reject(cancelled());
          job.controller.signal.addEventListener("abort", abort, {
            once: true,
          });
          timer = setTimeout(
            () =>
              reject(
                new ComponentRenderError(
                  "render-failed",
                  "The preview took too long. Try again or reset the props.",
                ),
              ),
            this.timeoutMs,
          );
        });
        const result = await Promise.race([
          this.worker.render(job.request),
          interrupted,
        ]);
        if (job.controller.signal.aborted) throw cancelled();
        job.resolve(result);
      } catch (error) {
        await this.worker?.close();
        this.worker = undefined;
        job.reject(error);
      } finally {
        clearTimeout(timer);
        job.controller.signal.removeEventListener("abort", abort);
        this.active = undefined;
      }
    }
  }
}
function cancelled(): ComponentRenderError {
  return new ComponentRenderError(
    "cancelled",
    "This preview request was replaced.",
  );
}
