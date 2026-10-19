import fs from "node:fs";
import path from "node:path";

import { faultCommand } from "./static_faults.js";

/** Cancellation releases the watcher and reaps even a child held at a signal gate. */
export async function signalFault(
  root: string,
  verb: "build" | "publish",
  mode: string,
  fault: string,
  signal: AbortSignal,
) {
  const readiness = faultReadiness(root, fault.split(",")[0]!, signal);
  const running = faultCommand(root, verb, fault, mode);
  const stop = () => running.child.kill("SIGKILL");
  signal.addEventListener("abort", stop, { once: true });
  try {
    await Promise.race([
      readiness.ready,
      running.result.then((result) => {
        throw new Error(`No fault readiness: ${result.stderr}`);
      }),
    ]);
    signal.throwIfAborted();
    running.child.kill("SIGINT");
    return await running.result;
  } finally {
    readiness.close();
    signal.removeEventListener("abort", stop);
    stop();
    await running.result;
  }
}

/** Register before the child starts; read the marker after each notification. */
export function faultReadiness(
  root: string,
  expected: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  let close = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      close();
      if (error) reject(error);
      else resolve();
    };
    const read = async () => {
      try {
        if (
          (await fs.promises.readFile(
            path.join(root, ".context/ready"),
            "utf8",
          )) === expected
        )
          finish();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") finish(error);
      }
    };
    const watcher = fs.watch(path.join(root, ".context"), () => void read());
    const abort = () => finish(signal.reason);
    close = () => {
      watcher.close();
      signal.removeEventListener("abort", abort);
    };
    watcher.once("error", finish);
    signal.addEventListener("abort", abort, { once: true });
    void read();
  });
  return { ready, close: () => close() };
}
