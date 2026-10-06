import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  InheritedProcessOwnerRegistrar,
  type ProcessOwnerRegistrar,
  type ProcessOwnerRegistration,
} from "./process_owner.js";
import type { BaselineProcessRequest } from "./types.js";
import type { WindowsProcessJob } from "./windows_job.js";

const PROCESS_DRAIN_TIMEOUT_MS = 5_000;

/** Own every subprocess of one command, including after its immediate launcher exits. */
export interface BaselineProcessScope {
  spawn(request: BaselineProcessRequest): ChildProcess;
  start(): void;
  terminate(signal: NodeJS.Signals): void;
  dispose(): Promise<void>;
}

export interface BaselineProcessScopeFactory {
  create(): Promise<BaselineProcessScope>;
}

export class NodeBaselineProcessScopeFactory implements BaselineProcessScopeFactory {
  constructor(
    private readonly registrar: ProcessOwnerRegistrar = new InheritedProcessOwnerRegistrar(),
  ) {}

  async create(): Promise<BaselineProcessScope> {
    if (process.platform !== "win32")
      return new NodeBaselineProcessScope(this.registrar);
    const { createWindowsProcessJob } = await import("./windows_job.js");
    return new NodeBaselineProcessScope(
      this.registrar,
      await createWindowsProcessJob(),
    );
  }
}

class NodeBaselineProcessScope implements BaselineProcessScope {
  private child: ChildProcess | undefined;
  private argv: readonly string[] = [];
  private registration: ProcessOwnerRegistration | undefined;

  constructor(
    private readonly registrar: ProcessOwnerRegistrar,
    private readonly job?: WindowsProcessJob,
  ) {}

  spawn(request: BaselineProcessRequest): ChildProcess {
    this.argv = request.argv;
    this.child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./process_worker.js", import.meta.url))],
      {
        cwd: request.cwd,
        env: { ...request.env },
        shell: false,
        windowsHide: true,
        detached: !this.job,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    if (this.child.pid !== undefined) {
      try {
        this.registration = this.registrar.register(this.child.pid);
      } catch (error) {
        terminateUnregisteredWorker(this.child, this.job !== undefined);
        throw error;
      }
    }
    return this.child;
  }

  /** The worker waits until process registration and Windows job assignment succeed. */
  start(): void {
    const child = this.child;
    if (!child) return;
    if (this.job && child.pid !== undefined) this.job.assign(child.pid);
    child.send({ argv: this.argv }, (error) => {
      if (error) child.emit("error", error);
    });
  }

  terminate(signal: NodeJS.Signals): void {
    const child = this.child;
    if (!child) return;
    if (this.job) {
      try {
        this.job.terminate();
      } finally {
        if (child.exitCode === null && child.signalCode === null)
          child.kill(signal);
      }
      return;
    }
    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
      }
    }
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal);
  }

  async dispose(): Promise<void> {
    if (this.job) await this.job.dispose();
    else if (this.child?.pid !== undefined) {
      this.terminate("SIGKILL");
      await waitForProcessGroupDrain(this.child.pid);
    }
    this.registration?.dispose();
    this.registration = undefined;
  }
}

function terminateUnregisteredWorker(
  child: ChildProcess,
  windowsJob: boolean,
): void {
  if (!windowsJob && child.pid !== undefined) {
    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  if (child.exitCode === null && child.signalCode === null)
    child.kill("SIGKILL");
}

async function waitForProcessGroupDrain(processGroupId: number): Promise<void> {
  const deadline = Date.now() + PROCESS_DRAIN_TIMEOUT_MS;
  while (processGroupExists(processGroupId)) {
    if (Date.now() >= deadline)
      throw new Error(`Process group did not drain: ${processGroupId}`);
    await pause(10);
  }
}

function processGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    if ((error as NodeJS.ErrnoException).code === "EPERM") return true;
    throw error;
  }
}
