/** Sample aggregate RSS without imposing an acceptance budget. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
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
  root: number,
  exceeded: (message: string, pids: number[]) => void,
) {
  let peakKiB = 0,
    totalPeakKiB = 0,
    samples = 0;
  let active: Promise<void> | undefined;
  const sample = async () => {
    try {
      const { stdout } = await execute("ps", ["-eo", "pid=,ppid=,pgid=,rss="], {
        maxBuffer: 4 * 1024 * 1024,
      });
      const rows = processRows(stdout);
      peakKiB = Math.max(peakKiB, treeRss(rows, root));
      totalPeakKiB = Math.max(totalPeakKiB, treeRss(rows, process.pid));
      samples++;
      // A shared-machine safety stop; this is not a pass/fail performance budget.
      if (totalPeakKiB > 1_750_000)
        exceeded(
          "Fixture exceeded the 1,750,000 KiB shared-machine RSS safety stop",
          processTree(rows, root).map((row) => row.pid),
        );
    } catch (error) {
      exceeded(`RSS sampling failed: ${String(error)}`, [root]);
    }
  };
  const tick = () => {
    if (!active)
      active = sample().finally(() => {
        active = undefined;
      });
  };
  tick();
  const timer = setInterval(tick, 50);
  return async () => {
    clearInterval(timer);
    await active;
    return { peakKiB, totalPeakKiB, samples, sampleIntervalMs: 50 };
  };
}
