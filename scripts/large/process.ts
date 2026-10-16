import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

import { monitor } from "./memory.js";
import { timingCollector } from "./timings.js";

export function start(args: string[], cwd: string) {
  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      MOKLY_OUTPUT: "plain",
      MOKLY_SIDECAR_TIMEOUT_MS: "300000",
    },
  });
  const timings = timingCollector();
  child.stderr.on("data", (chunk) => timings.accept(chunk));
  let stdout = "",
    stderr = "",
    failure: Error | undefined;
  const kill = (signal: NodeJS.Signals) => {
    if (child.pid === undefined) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const interrupt = () => {
    failure = new Error("Fixture run was interrupted");
    kill("SIGTERM");
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const finishMemory = monitor(child.pid ?? -1, (message, pids) => {
    failure = new Error(message);
    // Sidecars own separate process groups. Kill their descendants immediately
    // on a safety stop, before graceful cancellation can allocate more memory.
    for (const pid of pids.reverse()) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    kill("SIGTERM");
  });
  child.stdout.on("data", (chunk) => {
    stdout = (stdout + String(chunk)).slice(-512 * 1024);
  });
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + String(chunk)).slice(-512 * 1024);
  });
  const output = () => stdout + "\n" + stderr;
  const done = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (failure) reject(failure);
      else if (code === 0 || signal === "SIGTERM" || signal === "SIGINT")
        resolve();
      else
        reject(
          new Error(
            `Fixture command exited with ${code ?? signal}\n${output()}`,
          ),
        );
    });
  });
  void done
    .finally(() => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
    })
    .catch(() => {});
  return {
    child,
    done,
    kill,
    output,
    finishMemory,
    timings: timings.records,
  };
}
export type Running = ReturnType<typeof start>;
export async function stop(running: Running) {
  running.kill("SIGTERM");
  const timer = globalThis.setTimeout(() => running.kill("SIGKILL"), 10_000);
  try {
    await running.done;
  } finally {
    clearTimeout(timer);
  }
}
export async function waitFor(running: Running, pattern: RegExp) {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const match = running.output().match(pattern);
    if (match) return match;
    if (running.child.exitCode !== null || running.child.signalCode !== null) {
      await running.done;
      throw new Error(`Fixture exited before ${pattern}\n${running.output()}`);
    }
    await setTimeout(50);
  }
  throw new Error(
    `Fixture timed out waiting for ${pattern}\n${running.output()}`,
  );
}
