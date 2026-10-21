import type { ChildProcess } from "node:child_process";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { PostcssFailure } from "../generated/sidecar/PostcssFailure.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { SidecarError, detail } from "./errors.js";

interface Reply {
  id: number;
  result?: CssResult;
  error?: string;
  postcss?: PostcssFailure;
}

/** Failure state outlives individual requests, including asynchronous source lookup. */
export class PostcssProcess {
  private failure: SidecarError | undefined;
  private pending = new Map<
    number,
    {
      resolve(result: CssResult): void;
      reject(error: Error): void;
    }
  >();

  constructor(
    readonly child: ChildProcess,
    private readonly failed: () => void,
  ) {
    child.on("error", (error) => this.fail(error));
    child.once("exit", (code, signal) =>
      this.fail(new Error(`PostCSS worker exited with ${signal ?? code}`)),
    );
    child.once("disconnect", () =>
      this.fail(new Error("PostCSS worker disconnected")),
    );
    child.on("message", (message: Reply) => {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error)
        pending.reject(
          new SidecarError("bundle-failed", message.error, message.postcss),
        );
      else pending.resolve(message.result!);
    });
  }

  send(message: object): void {
    if (this.failure) return;
    try {
      this.child.send(message, (error) => {
        if (error) this.fail(error);
      });
    } catch (error) {
      this.fail(error);
    }
  }

  request(id: number, params: ProcessCssParams): Promise<CssResult> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ id, params });
    });
  }

  private fail(error: unknown): void {
    if (this.failure) return;
    this.failure = new SidecarError("bundle-failed", detail(error));
    for (const pending of this.pending.values()) pending.reject(this.failure);
    this.pending.clear();
    this.failed();
    if (this.child.exitCode === null && this.child.signalCode === null)
      this.child.kill("SIGKILL");
  }
}
