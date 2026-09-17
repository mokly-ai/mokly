/** Local controls own generation, worker admission, and memory lifetime together. */
import { randomBytes } from "node:crypto";

import {
  ComponentRenderError,
  type ComponentRenderSuccess,
  type RenderCapability,
} from "@mokly/viewer/data";

import type { ComponentRuntime } from "../../build/component_runtime.js";
import { validateRenderRequest } from "../../components/render_request.js";

import { RenderQueue } from "./queue.js";
import { RenderStore } from "./store.js";
import { NodeRenderWorkerFactory } from "./worker_client.js";

export class ComponentRenderService {
  readonly token = randomBytes(32).toString("hex");
  readonly store = new RenderStore();
  private queue: RenderQueue;
  private replacement: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(private runtime: ComponentRuntime) {
    this.queue = new RenderQueue(new NodeRenderWorkerFactory(runtime));
  }
  capability(): RenderCapability {
    return { token: this.token, generation: this.runtime.generation };
  }
  replace(runtime: ComponentRuntime): void {
    const previous = this.queue;
    this.replacement = Promise.all([this.replacement, previous.close()]).then(
      () => {},
    );
    this.runtime = runtime;
    this.store.clear();
    this.queue = new RenderQueue(new NodeRenderWorkerFactory(runtime));
  }
  async render(
    value: unknown,
    signal: AbortSignal,
  ): Promise<ComponentRenderSuccess> {
    const { request } = validateRenderRequest(
      value,
      this.runtime.manifest,
      this.runtime.generation,
    );
    await this.replacement;
    if (this.closed || signal.aborted)
      throw new ComponentRenderError(
        "cancelled",
        "The preview request was cancelled.",
      );
    if (request.generation !== this.runtime.generation)
      throw new ComponentRenderError(
        "stale-generation",
        "The catalogue changed. Reload to continue editing.",
      );
    const result = await this.queue.render(request, signal);
    if (signal.aborted || request.generation !== this.runtime.generation)
      throw new ComponentRenderError(
        "cancelled",
        "The preview request was replaced.",
      );
    return this.store.put(result, request.generation);
  }
  async close(): Promise<void> {
    this.closed = true;
    await Promise.all([this.replacement, this.queue.close()]);
    this.store.clear();
  }
}
