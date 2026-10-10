import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

import { timingCollector } from "./timings.mjs";

/** Stream diagnostics live while retaining the small CLI log for readiness checks. */
export function start(args, cwd, environment = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  const timings = timingCollector();
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    timings.accept(chunk);
    process.stderr.write(chunk);
  });
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0 || signal === "SIGTERM" || signal === "SIGINT") resolve();
      else reject(new Error(`Fixture command exited with ${code ?? signal}`));
    });
  });
  void done.catch(() => {});
  return {
    child,
    done,
    output: () => stdout + "\n" + stderr,
    timings: timings.records,
  };
}

export async function stop(running) {
  if (running.child.exitCode !== null || running.child.signalCode !== null)
    return running.done;
  running.child.kill("SIGTERM");
  const timer = globalThis.setTimeout(
    () => running.child.kill("SIGKILL"),
    10000,
  );
  try {
    await running.done;
  } finally {
    clearTimeout(timer);
  }
}

export async function waitFor(running, pattern) {
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    const match = running.output().match(pattern);
    if (match) return match;
    if (running.child.exitCode !== null || running.child.signalCode !== null) {
      await running.done;
      throw new Error(`Fixture exited before ${pattern}`);
    }
    await setTimeout(100);
  }
  throw new Error(`Fixture timed out waiting for ${pattern}`);
}
