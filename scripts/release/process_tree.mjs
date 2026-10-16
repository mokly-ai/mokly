/** Live process listings from `ps`, for draining a process group. */
import { execFileSync } from "node:child_process";

function listing(fields) {
  return execFileSync("ps", ["-A", "-o", fields], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/u));
}

/** Every live process below `pid`, from one `ps` listing. */
export function processTree(pid) {
  const rows = listing("pid=,ppid=,pgid=,stat=,args=").map(
    ([child, parent, group, stat, ...args]) => ({
      pid: Number(child),
      ppid: Number(parent),
      pgid: Number(group),
      zombie: stat.startsWith("Z"),
      command: args.join(" "),
    }),
  );
  const tree = [];
  const parents = new Set([pid]);
  for (let grown = true; grown;) {
    grown = false;
    for (const row of rows)
      if (parents.has(row.ppid) && !parents.has(row.pid)) {
        parents.add(row.pid);
        if (!row.zombie) tree.push(row);
        grown = true;
      }
  }
  return tree;
}

/**
 * The recorded processes that still run. A process counts only with the same
 * PID in the same process group, so a reused PID reads as ended, and an
 * exited zombie counts as ended.
 */
export function running(processes) {
  const live = new Set(
    listing("pid=,pgid=,stat=")
      .filter(([, , stat]) => !stat.startsWith("Z"))
      .map(([pid, pgid]) => `${pid}:${pgid}`),
  );
  return processes.filter(({ pid, pgid }) => live.has(`${pid}:${pgid}`));
}
