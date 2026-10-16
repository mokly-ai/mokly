/**
 * Run `mokly serve` through a shim in its own process group. A caller
 * registers `stop` before it waits for the listening line, so a setup failure
 * drains the same processes as a normal teardown: the shim, the native
 * binary, and the sidecars that the binary starts in their own groups.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

import { processTree, running } from "./process_tree.mjs";

const posix = process.platform !== "win32";

function signalGroup(pgid, name) {
  try {
    process.kill(-pgid, name);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

/**
 * Record the group in the verification owner registry when a report-producing
 * wrapper runs this process, so that an interrupted run signals the group too.
 * Returns the record's removal.
 */
function registerGroup(pgid, env) {
  const registry = env.MOKLY_VERIFICATION_PROCESS_REGISTRY;
  const ownerId = env.MOKLY_VERIFICATION_OWNER_ID;
  if (!posix || !registry || !ownerId) return () => {};
  const id = randomUUID();
  const target = path.join(registry, `process-${id}.json`);
  const temporary = path.join(registry, `.process-${id}-${process.pid}.tmp`);
  const record = { schemaVersion: 1, type: "process", ownerId };
  fs.writeFileSync(
    temporary,
    `${JSON.stringify({ ...record, processGroupId: pgid })}\n`,
    { flag: "wx", mode: 0o600 },
  );
  fs.renameSync(temporary, target);
  return () => fs.rmSync(target, { force: true });
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

/** Whether every recorded process ends within the allowance. */
async function ended(processes, allowance) {
  const deadline = AbortSignal.timeout(allowance);
  while (running(processes).length > 0) {
    if (deadline.aborted) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

/** The process tree, or nothing when `ps` fails; the caller still signals. */
function snapshot(pid, failures) {
  try {
    return processTree(pid);
  } catch (error) {
    failures.push(error);
    return [];
  }
}

async function drainWindows(child) {
  // The shim can exit before taskkill runs, so its status is not checked.
  if (child.exitCode === null && child.signalCode === null)
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  const exited = await exits(child, 30_000);
  child.stdout?.destroy();
  child.stderr?.destroy();
  if (!exited) throw new Error(`Serve shim ${child.pid} still runs`);
}

async function drain(child, unregister) {
  if (!posix) {
    await drainWindows(child);
    return { code: child.exitCode, signal: child.signalCode };
  }
  // Record the tree before any signal: after the binary exits, its sidecars
  // move to another parent and only their recorded groups still name them.
  const failures = [];
  const tree = snapshot(child.pid, failures);
  signalGroup(child.pid, "SIGINT");
  if (!(await exits(child, 30_000))) {
    // A process started after the first snapshot is in this one.
    for (const late of snapshot(child.pid, failures))
      if (!tree.some(({ pid }) => pid === late.pid)) tree.push(late);
    signalGroup(child.pid, "SIGKILL");
    await exits(child, 10_000);
  }
  const recorded = [{ pid: child.pid, pgid: child.pid }, ...tree];
  if (!(await ended(recorded, 10_000))) {
    for (const { pgid } of tree) signalGroup(pgid, "SIGKILL");
    if (!(await ended(recorded, 10_000)))
      failures.push(
        new Error(
          `Serve processes still run: ${running(recorded)
            .map(({ pid }) => pid)
            .join(", ")}`,
        ),
      );
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  if (failures.length > 0)
    throw new AggregateError(failures, "Serve's process group did not drain");
  unregister();
  return { code: child.exitCode, signal: child.signalCode };
}

/** Start `node {shim} serve {args}` in its own process group. */
export function spawnServe(shim, args, { cwd, env = {} }) {
  const environment = { ...process.env, MOKLY_OUTPUT: "plain", ...env };
  const child = spawn(process.execPath, [shim, "serve", ...args], {
    cwd,
    detached: posix,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let unregister;
  try {
    unregister = registerGroup(child.pid, environment);
  } catch (error) {
    signalGroup(child.pid, "SIGKILL");
    throw error;
  }
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
      stopping ??= drain(child, unregister);
      return stopping;
    },
  };
}
