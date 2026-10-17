/** Stop the complete owned group before per-process cleanup, and end sampling on exit. */
import type { ChildState } from "./lifetime.js";
import { DEFAULT_MEMORY_STOP_KIB, monitor } from "./memory.js";
import type { MemorySystem } from "./memory.js";

interface ObservedChild extends ChildState {
  once(event: "exit", callback: () => void): unknown;
}
export function monitorChild(
  child: ObservedChild,
  killGroup: (signal: NodeJS.Signals) => void,
  failed: (message: string) => void,
  stopKiB = DEFAULT_MEMORY_STOP_KIB,
  boundary?: MemorySystem,
) {
  const finish = monitor(
    child.pid,
    (message) => {
      failed(message);
      try {
        killGroup("SIGKILL");
      } catch (error) {
        failed(`${message}; group shutdown failed: ${String(error)}`);
      }
    },
    stopKiB,
    boundary,
  );
  child.once("exit", () => {
    void finish();
  });
  return finish;
}
