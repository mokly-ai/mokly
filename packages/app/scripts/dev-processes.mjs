import { spawn } from "node:child_process";
import { connect } from "node:net";
import { createInterface } from "node:readline";

/** How long a stopped service may take to exit before it gets SIGKILL. */
const STOP_GRACE_MS = 10_000;

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
export function startService(name, command, args, { cwd, env }) {
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

  // Signal the whole group even after the leader exited, so no process that
  // it started outlives the launcher.
  const signal = (kind) => {
    if (child.pid === undefined) return;
    try {
      process.kill(-child.pid, kind);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const stop = async () => {
    signal("SIGTERM");
    const timer = setTimeout(() => signal("SIGKILL"), STOP_GRACE_MS);
    await exited;
    clearTimeout(timer);
  };
  return { name, exited, stop };
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
 * Settle on the first SIGINT, SIGTERM or SIGHUP that the launcher gets. The
 * listeners stay, so a second Ctrl+C does not end the launcher before it has
 * stopped its services.
 */
export function interruption() {
  return new Promise((resolve) => {
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
      process.on(signal, () => resolve());
  });
}
