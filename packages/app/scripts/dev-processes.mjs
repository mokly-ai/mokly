import { spawn } from "node:child_process";
import { connect } from "node:net";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";

/** How long a stopped service group may take to exit before it gets SIGKILL. */
const STOP_GRACE_MS = 10_000;
/** The wait between two checks of whether a stopped group still has a process. */
const GROUP_POLL_MS = 50;

/** The process group of every service that has not stopped yet. */
const liveGroups = new Set();

/** Send the signal to the process group, and ignore a group that has gone. */
function signalGroup(group, kind) {
  try {
    process.kill(-group, kind);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

/** Whether any process of the group still runs. */
function groupExists(group) {
  try {
    process.kill(-group, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

/**
 * Run a one-shot command with the terminal's streams and resolve with its exit
 * status. A command that cannot start resolves with 1 after a report.
 */
export function runCommand(command, args, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.once("error", (error) => {
      console.error(`${command} could not start: ${error.message}`);
      resolve(1);
    });
    child.once("exit", (status) => resolve(status ?? 1));
  });
}

/**
 * Start a long-running service in its own process group, and print each line
 * of its output with a `[name]` prefix. Its own group lets `stop` reach the
 * processes that the service starts, such as the binary under `cargo run`.
 */
export function startService(
  name,
  command,
  args,
  { cwd, env, graceMs = STOP_GRACE_MS },
) {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise((resolve) => {
    child.once("error", (error) => {
      console.error(`[${name}] could not start: ${error.message}`);
      resolve(1);
    });
    child.once("exit", (status) => resolve(status));
  });
  prefix(child.stdout, process.stdout, name);
  prefix(child.stderr, process.stderr, name);

  const group = child.pid;
  if (group !== undefined) liveGroups.add(group);

  // Stop the whole group, and keep the grace period after the leader exits,
  // so that no process that the service started outlives the launcher.
  const stop = async () => {
    if (group === undefined) return void (await exited);
    signalGroup(group, "SIGTERM");
    const timer = setTimeout(() => signalGroup(group, "SIGKILL"), graceMs);
    await exited;
    while (groupExists(group)) await delay(GROUP_POLL_MS);
    clearTimeout(timer);
    liveGroups.delete(group);
  };
  return { name, pid: group, exited, stop };
}

function prefix(input, output, name) {
  createInterface({ input, crlfDelay: Infinity }).on("line", (line) =>
    output.write(`[${name}] ${line}\n`),
  );
}

/** Whether a TCP server accepts connections on the host and port. */
export function listening(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.setTimeout(1_000);
    const settle = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

/** Whether a GET of the URL answers with a 2xx status. */
export async function answers(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Settle on the first SIGINT, SIGTERM or SIGHUP that the launcher gets, so the
 * stack stops its services in order. A second signal sends SIGKILL to every
 * service group that has not stopped, so the user can always end the stop.
 */
export function interruption() {
  return new Promise((resolve) => {
    let received = 0;
    const handle = () => {
      received += 1;
      if (received === 1) return resolve();
      for (const group of liveGroups) signalGroup(group, "SIGKILL");
    };
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
      process.on(signal, handle);
  });
}
