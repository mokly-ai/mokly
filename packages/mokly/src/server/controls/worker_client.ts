/** Main-thread interface to the supervised consumer renderer. */
import { Worker } from "node:worker_threads";

import {
  ComponentRenderError,
  type ComponentRenderRequest,
} from "@mokly/viewer/data";

import { compactRuntime } from "../../build/compact_runtime.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type {
  AcceptedMoveTargets,
  MoveTargetsProvider,
} from "../../build/move_targets.js";
import { errorMessage } from "../../errors.js";

import type { TransientRender } from "./transient_assets.js";

export interface RenderWorker {
  render(request: ComponentRenderRequest): Promise<TransientRender>;
  close(): Promise<void>;
}
export interface RenderWorkerFactory {
  create(): RenderWorker;
}
export interface RenderWorkerRequest {
  request: ComponentRenderRequest;
  moveTargets?: AcceptedMoveTargets;
}
export class NodeRenderWorkerFactory implements RenderWorkerFactory {
  constructor(
    private readonly runtime: ComponentRuntime,
    private readonly moveTargets?: MoveTargetsProvider,
  ) {}
  create(): RenderWorker {
    return new NodeRenderWorker(this.runtime, this.moveTargets);
  }
}
class NodeRenderWorker implements RenderWorker {
  private readonly worker: Worker;
  constructor(
    private readonly runtime: ComponentRuntime,
    private readonly moveTargets?: MoveTargetsProvider,
  ) {
    this.worker = new Worker(new URL("./worker.js", import.meta.url), {
      workerData: compactRuntime(runtime),
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    this.worker.on("error", () => {});
  }
  render(request: ComponentRenderRequest): Promise<TransientRender> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.worker.off("message", message);
        this.worker.off("error", errored);
        this.worker.off("exit", exited);
      };
      const failed = (detail?: string) => {
        cleanup();
        reject(
          new ComponentRenderError(
            "render-failed",
            "The preview could not be rendered. Try again or reset the props.",
            detail,
          ),
        );
      };
      const errored = (error: Error) => failed(errorMessage(error));
      const exited = () => failed();
      const message = (
        value:
          { ok: true; result: TransientRender } | { ok: false; reason: string },
      ) => {
        if (!value.ok) return failed(value.reason);
        cleanup();
        resolve(value.result);
      };
      this.worker.once("message", message);
      this.worker.once("error", errored);
      this.worker.once("exit", exited);
      const moveTargets = this.moveTargets?.(this.runtime.generation);
      this.worker.postMessage({
        request,
        ...(moveTargets ? { moveTargets } : {}),
      } satisfies RenderWorkerRequest);
    });
  }
  async close(): Promise<void> {
    await this.worker.terminate();
  }
}
