/** Sample aggregate RSS without imposing an acceptance budget. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { killProcesses, validPid } from "./signals.js";

const execute = promisify(execFile);
export const DEFAULT_MEMORY_STOP_KIB = 1_750_000;
export interface MemorySystem {
  pid: number;
  ps(): Promise<string>;
  kill(pid: number, signal: NodeJS.Signals): void;
  every(sample: () => void, intervalMs: number): () => void;
}
const system: MemorySystem = {
  pid: process.pid,
  ps: async () =>
    (
      await execute("ps", ["-eo", "pid=,ppid=,pgid=,rss="], {
        maxBuffer: 4 * 1024 * 1024,
      })
    ).stdout,
  kill: (pid, signal) => {
    process.kill(pid, signal);
  },
  every: (sample, interval) => {
    const timer = setInterval(sample, interval);
    return () => clearInterval(timer);
  },
};
export interface ProcessRow {
  pid: number;
  parent: number;
  group: number;
  rssKiB: number;
}
export function processRows(text: string): ProcessRow[] {
  return text
    .trim()
    .split("\n")
    .flatMap((line) => {
      const [pid, parent, group, rssKiB] = line.trim().split(/\s+/).map(Number);
      return [pid, parent, group, rssKiB].every((value) =>
        Number.isFinite(value),
      )
        ? [{ pid: pid!, parent: parent!, group: group!, rssKiB: rssKiB! }]
        : [];
    });
}
function processTree(rows: ProcessRow[], root: number): ProcessRow[] {
  const children = new Map<number, ProcessRow[]>();
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  for (const row of rows)
    children.set(row.parent, [...(children.get(row.parent) ?? []), row]);
  const result: ProcessRow[] = [],
    pending = [root],
    seen = new Set<number>();
  while (pending.length) {
    const pid = pending.pop()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    const row = byPid.get(pid);
    if (row) result.push(row);
    pending.push(...(children.get(pid) ?? []).map((child) => child.pid));
  }
  return result;
}
export function treeRss(rows: ProcessRow[], root: number): number {
  return processTree(rows, root).reduce((sum, row) => sum + row.rssKiB, 0);
}
export function monitor(
  root: number | undefined,
  failed: (message: string) => void,
  stopKiB = DEFAULT_MEMORY_STOP_KIB,
  boundary: MemorySystem = system,
) {
  let peakKiB = 0,
    totalPeakKiB = 0,
    samples = 0,
    stopped = false;
  let active: Promise<void> | undefined;
  let cancel = () => {};
  const stop = async () => {
    stopped = true;
    cancel();
    await active;
    return { peakKiB, totalPeakKiB, samples, sampleIntervalMs: 50 };
  };
  // No process was started. Never manufacture a sentinel PID for sampling or signals.
  if (!validPid(root, boundary.pid)) return stop;
  const abort = (message: string, pids: number[]) => {
    if (stopped) return;
    stopped = true;
    cancel();
    // Signal the owned group while its leader is unreaped and its ID reserved.
    failed(message);
    try {
      killProcesses(pids, boundary.kill, boundary.pid);
    } catch (error) {
      failed(`${message}; shutdown failed: ${String(error)}`);
    }
  };
  const sample = async () => {
    let rows: ProcessRow[];
    try {
      rows = processRows(await boundary.ps());
    } catch (error) {
      abort(`RSS sampling failed: ${String(error)}`, [root]);
      return;
    }
    if (stopped) return;
    peakKiB = Math.max(peakKiB, treeRss(rows, root));
    totalPeakKiB = Math.max(totalPeakKiB, treeRss(rows, boundary.pid));
    samples++;
    if (stopKiB > 0 && totalPeakKiB > stopKiB)
      abort(
        `Fixture exceeded the ${stopKiB.toLocaleString("en-US")} KiB shared-machine RSS safety stop`,
        processTree(rows, root).map((row) => row.pid),
      );
  };
  const tick = () => {
    if (!stopped && !active)
      active = sample().finally(() => {
        active = undefined;
      });
  };
  cancel = boundary.every(tick, 50);
  tick();
  return stop;
}
