import type { ChildProcess } from "node:child_process";

import type { BaselineProcessScope } from "../../packages/mokly/dist/baseline/process_scope.js";

import type { PreviewServerProcess } from "./preview_fixture.js";

const MAX_DIAGNOSTIC_BYTES = 64 * 1_024;

export class ScopedPreviewProcess implements PreviewServerProcess {
  private closing: Promise<void> | undefined;
  private readonly chunks: Buffer[] = [];
  private diagnosticBytes = 0;
  private processFailure: Error | undefined;
  private readonly launcherExited: Promise<void>;
  private readonly settled: Promise<void>;

  constructor(
    private readonly child: ChildProcess,
    private readonly scope: BaselineProcessScope,
  ) {
    child.stdout?.on("data", (chunk: Buffer) => this.capture(chunk));
    child.stderr?.on("data", (chunk: Buffer) => this.capture(chunk));
    let resolveLauncher = () => {};
    this.launcherExited = new Promise((resolve) => {
      resolveLauncher = resolve;
    });
    this.settled = new Promise((resolve) => {
      child.once("error", (error) => {
        this.processFailure = error;
        resolveLauncher();
        resolve();
      });
      child.once("exit", () => resolveLauncher());
      child.once("close", () => resolve());
    });
  }

  get exited(): boolean {
    return (
      this.processFailure !== undefined ||
      this.child.exitCode !== null ||
      this.child.signalCode !== null
    );
  }

  get output(): string {
    const diagnostic = Buffer.concat(this.chunks).toString("utf8");
    return this.processFailure
      ? `${diagnostic}${diagnostic ? "\n" : ""}${this.processFailure.message}`
      : diagnostic;
  }

  close(): Promise<void> {
    this.closing ??= this.closeOnce();
    return this.closing;
  }

  private capture(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.diagnosticBytes += chunk.byteLength;
    while (this.diagnosticBytes > MAX_DIAGNOSTIC_BYTES) {
      const removed = this.chunks.shift();
      if (!removed) break;
      this.diagnosticBytes -= removed.byteLength;
    }
  }

  private async closeOnce(): Promise<void> {
    const failures: unknown[] = [];
    try {
      this.scope.terminate("SIGTERM");
    } catch (error) {
      failures.push(error);
    }
    await boundedWait(this.launcherExited, 5_000);
    try {
      this.scope.terminate("SIGKILL");
    } catch (error) {
      failures.push(error);
    }
    if (!(await boundedWait(this.settled, 5_000))) {
      failures.push(new Error("preview launcher did not stop after SIGKILL"));
    }
    try {
      await this.scope.dispose();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "preview process-tree cleanup failed");
  }
}

async function boundedWait(
  operation: Promise<void>,
  milliseconds: number,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), milliseconds);
  });
  const completed = await Promise.race([
    operation.then(() => true as const),
    timeout,
  ]);
  clearTimeout(timer);
  return completed;
}
