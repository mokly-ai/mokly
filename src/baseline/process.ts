import type { ChildProcess } from "node:child_process";

import {
  NodeBaselineExecutableResolver,
  type BaselineExecutableResolver,
} from "./executable.js";
import {
  NodeBaselineProcessScopeFactory,
  type BaselineProcessScopeFactory,
} from "./process_scope.js";
import type {
  BaselineProcessRequest,
  BaselineProcessResult,
  BaselineProcessRunner,
} from "./types.js";

const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024;
export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

/** Bounded subprocess capture; cancellation drains the process group before settling. */
export class NodeBaselineProcessRunner implements BaselineProcessRunner {
  constructor(
    private readonly executable: BaselineExecutableResolver = new NodeBaselineExecutableResolver(),
    private readonly scopes: BaselineProcessScopeFactory = new NodeBaselineProcessScopeFactory(),
  ) {}
  readonly pid = process.pid;
  isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== "ESRCH";
    }
  }

  async run(request: BaselineProcessRequest): Promise<BaselineProcessResult> {
    request.signal?.throwIfAborted();
    const [executable, ...args] = await this.executable.resolve(request);
    request.signal?.throwIfAborted();
    if (!executable) throw new Error("Baseline command has no executable");
    const scope = await this.scopes.create();
    if (request.signal?.aborted) {
      await scope.dispose();
      request.signal.throwIfAborted();
    }
    return new Promise((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = scope.spawn({ ...request, argv: [executable, ...args] });
      } catch (error) {
        void scope.dispose().then(
          () => reject(error),
          () => reject(error),
        );
        return;
      }
      let failure: unknown;
      let tail = Buffer.alloc(0);
      const stdout: Buffer[] = [];
      let stdoutBytes = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const terminate = (signal: NodeJS.Signals) => {
        try {
          scope.terminate(signal);
        } catch (error) {
          failure ??= error;
        }
      };
      const stop = () => {
        if (timer) return;
        timer = setTimeout(() => terminate("SIGKILL"), 1000);
        terminate("SIGTERM");
      };
      const abort = () => {
        failure =
          request.signal?.reason ?? new Error("Baseline command interrupted");
        stop();
      };
      const capture = (chunk: Buffer) => {
        tail = Buffer.concat([
          tail,
          chunk.subarray(-MAX_COMMAND_OUTPUT_BYTES),
        ]).subarray(-MAX_COMMAND_OUTPUT_BYTES);
      };
      child.stdout!.on("data", (chunk: Buffer) => {
        capture(chunk);
        if (!request.captureArchive || failure) return;
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > MAX_ARCHIVE_BYTES) {
          failure = new Error("Git archive exceeds 64 MiB");
          stop();
        } else stdout.push(chunk);
      });
      child.stderr!.on("data", capture);
      child.once("error", (error) => {
        failure ??= error;
        stop();
      });
      child.once("close", async (exitCode, signal) => {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", abort);
        if (failure) terminate("SIGKILL");
        try {
          await scope.dispose();
        } catch (error) {
          failure ??= error;
        }
        if (failure) {
          reject(failure);
        } else
          resolve({
            exitCode,
            signal,
            output: tail.toString("utf8"),
            stdout: Buffer.concat(stdout),
          });
      });
      request.signal?.addEventListener("abort", abort, { once: true });
      if (request.signal?.aborted) abort();
      else {
        try {
          scope.start();
        } catch (error) {
          failure ??= error;
          stop();
        }
      }
    });
  }
}
