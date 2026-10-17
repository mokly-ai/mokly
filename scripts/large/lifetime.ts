/** A running child owns one process group and one synchronous exit cleanup. */
import { validPid } from "./signals.js";

export interface ChildState {
  pid?: number | undefined;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
}
export interface LifetimeSystem {
  pid: number;
  kill(pid: number, signal: NodeJS.Signals): void;
  onExit(callback: () => void): () => void;
}
const system: LifetimeSystem = {
  pid: process.pid,
  kill: (pid, signal) => {
    process.kill(pid, signal);
  },
  onExit: (callback) => {
    process.once("exit", callback);
    return () => {
      process.off("exit", callback);
    };
  },
};
export function lifetime(child: ChildState, boundary: LifetimeSystem = system) {
  let finished = false;
  const kill = (signal: NodeJS.Signals) => {
    if (
      finished ||
      !validPid(child.pid, boundary.pid) ||
      child.exitCode !== null ||
      child.signalCode !== null
    )
      return;
    try {
      boundary.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const remove = boundary.onExit(() => kill("SIGKILL"));
  return {
    kill,
    finish: () => {
      finished = true;
      remove();
    },
  };
}

/** Deadlines share the same graceful-then-forceful shutdown as normal cleanup. */
export async function stopChild(
  running: { done: Promise<void>; kill(signal: NodeJS.Signals): void },
  later: (kill: () => void) => () => void = (kill) => {
    const timer = setTimeout(kill, 10_000);
    return () => clearTimeout(timer);
  },
) {
  running.kill("SIGTERM");
  const cancel = later(() => running.kill("SIGKILL"));
  try {
    await running.done;
  } finally {
    cancel();
  }
}
