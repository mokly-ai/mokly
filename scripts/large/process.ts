import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

import { lifetime, stopChild } from "./lifetime.js";
import { DEFAULT_MEMORY_STOP_KIB, monitor } from "./memory.js";
import { validPid } from "./signals.js";
import { timingCollector } from "./timings.js";

export function start(
  args: string[],
  cwd: string,
  memoryStopKiB = DEFAULT_MEMORY_STOP_KIB,
  sidecarTimeoutMs?: number,
) {
  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      MOKLY_OUTPUT: "plain",
      ...(sidecarTimeoutMs === undefined
        ? {}
        : { MOKLY_SIDECAR_TIMEOUT_MS: String(sidecarTimeoutMs) }),
    },
  });
  const timings = timingCollector();
  child.stderr.on("data", (chunk) => timings.accept(chunk));
  let stdout = "",
    stderr = "",
    failure: Error | undefined;
  const owned = lifetime(child);
  const kill = owned.kill;
  const interrupt = () => {
    failure = new Error("Fixture run was interrupted");
    kill("SIGTERM");
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const finishMemory = validPid(child.pid)
    ? monitor(
        child.pid,
        (message) => {
          failure = new Error(message);
        },
        memoryStopKiB,
      )
    : async () => ({
        peakKiB: 0,
        totalPeakKiB: 0,
        samples: 0,
        sampleIntervalMs: 50,
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
      owned.finish();
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
  await stopChild(running);
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
