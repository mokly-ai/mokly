/** Observe the setup harness and its descendants without signalling the harness. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { processRows, treeRss } from "./memory.js";

export interface SetupSystem {
  pid: number;
  now(): number;
  ps(): Promise<string>;
  every(sample: () => void, intervalMs: number): () => void;
}
export interface SetupMemory {
  peakKiB: number;
  samples: number;
  sampleIntervalMs: number;
  observations: { elapsedMs: number; rssKiB: number }[];
  error?: string;
}
const execute = promisify(execFile);
export const setupSystem: SetupSystem = {
  pid: process.pid,
  now: () => performance.now(),
  ps: async () =>
    (
      await execute("ps", ["-eo", "pid=,ppid=,pgid=,rss="], {
        maxBuffer: 4 * 1024 * 1024,
      })
    ).stdout,
  every: (sample, intervalMs) => {
    const timer = setInterval(sample, intervalMs);
    return () => clearInterval(timer);
  },
};

export function observeSetup(boundary: SetupSystem, beginning: number) {
  let stopped = false;
  let active: Promise<void> | undefined;
  let completed: Promise<SetupMemory> | undefined;
  const result: SetupMemory = {
    peakKiB: 0,
    samples: 0,
    sampleIntervalMs: 50,
    observations: [],
  };
  const sample = async () => {
    if (result.error) return;
    try {
      const rows = processRows(await boundary.ps());
      if (!rows.some((row) => row.pid === boundary.pid))
        throw new Error("The setup process is absent from the RSS sample");
      const rssKiB = treeRss(rows, boundary.pid);
      if (!Number.isFinite(rssKiB) || rssKiB < 0)
        throw new Error("The setup process family has invalid RSS");
      result.peakKiB = Math.max(result.peakKiB, rssKiB);
      result.samples++;
      result.observations.push({
        elapsedMs: boundary.now() - beginning,
        rssKiB,
      });
    } catch (error) {
      result.error = `Setup RSS sampling failed: ${String(error)}`;
    }
  };
  const tick = () => {
    if (!stopped && !active && !result.error)
      active = sample().finally(() => {
        active = undefined;
      });
  };
  const cancel = boundary.every(tick, 50);
  tick();
  const finish = async () => {
    stopped = true;
    cancel();
    await active;
    await sample();
    return result;
  };
  return () => (completed ??= finish());
}
