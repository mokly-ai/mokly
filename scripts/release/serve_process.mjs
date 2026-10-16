/**
 * Run `mokly serve` through a shim in its own process group. A caller
 * registers `stop` before it waits for the listening line, so a setup failure
 * drains the same processes as a normal teardown: the shim, the native
 * binary, and the sidecars that the binary starts in their own groups.
 */
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

const posix = process.platform !== "win32";

/** Every live process below `pid`, from one `ps` listing. */
export function processTree(pid) {
  const rows = execFileSync(
    "ps",
    ["-A", "-o", "pid=,ppid=,pgid=,stat=,args="],
    {
      encoding: "utf8",
    },
  )
    .trim()
    .split("\n")
    .map((line) => {
      const [child, parent, group, stat, ...args] = line.trim().split(/\s+/u);
      return {
        pid: Number(child),
        ppid: Number(parent),
        pgid: Number(group),
        zombie: stat.startsWith("Z"),
        command: args.join(" "),
      };
    });
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

/** The listed processes that still run; an exited zombie counts as gone. */
export function running(pids) {
  const live = new Set(
    execFileSync("ps", ["-A", "-o", "pid=,stat="], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/u))
      .filter(([, stat]) => !stat.startsWith("Z"))
      .map(([pid]) => Number(pid)),
  );
  return pids.filter((pid) => live.has(pid));
}

function signalGroup(pgid, name) {
  try {
    process.kill(-pgid, name);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

/** Whether `child` exits within the allowance. */
async function exits(child, allowance) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  try {
    await once(child, "exit", { signal: AbortSignal.timeout(allowance) });
    return true;
  } catch (error) {
    if (error.name === "AbortError") return false;
    throw error;
  }
}

/** Whether every listed process ends within the allowance. */
async function ended(pids, allowance) {
  const deadline = AbortSignal.timeout(allowance);
  while (running(pids).length > 0) {
    if (deadline.aborted) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

async function drain(child) {
  if (!posix) {
    if (child.exitCode === null && child.signalCode === null)
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    await exits(child, 30_000);
    return { code: child.exitCode, signal: child.signalCode };
  }
  // Record the tree first: after the binary exits, its sidecars move to
  // another parent and only their recorded groups still name them.
  const tree = processTree(child.pid);
  signalGroup(child.pid, "SIGINT");
  if (!(await exits(child, 30_000))) {
    signalGroup(child.pid, "SIGKILL");
    await exits(child, 10_000);
  }
  const pids = [child.pid, ...tree.map(({ pid }) => pid)];
  if (!(await ended(pids, 10_000))) {
    for (const { pgid } of tree) signalGroup(pgid, "SIGKILL");
    if (!(await ended(pids, 10_000)))
      throw new Error(`Serve processes still run: ${running(pids).join(", ")}`);
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  return { code: child.exitCode, signal: child.signalCode };
}

/** Start `node {shim} serve {args}` in its own process group. */
export function spawnServe(shim, args, { cwd, env = {} }) {
  const child = spawn(process.execPath, [shim, "serve", ...args], {
    cwd,
    detached: posix,
    env: { ...process.env, MOKLY_OUTPUT: "plain", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  let stopping;
  return {
    child,
    stderr: () => stderr,
    /** The URL from Serve's listening line; the signal bounds the wait. */
    async listening(signal) {
      const lines = createInterface({ input: child.stdout, signal });
      for await (const line of lines) {
        const match = /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/u.exec(
          line,
        );
        if (match) {
          child.stdout.resume();
          return match[1];
        }
      }
      throw new Error(`Serve stopped before it listened: ${stderr}`);
    },
    /** Interrupt Serve, kill what stays, and confirm that every process ended. */
    stop() {
      stopping ??= drain(child);
      return stopping;
    },
  };
}
