import { spawn, spawnSync } from "node:child_process";

export async function runInherited(program, args, options = {}) {
  const child = start(program, args, options, "inherit");
  return await completion(child);
}

export async function runCaptured(program, args, options = {}) {
  const child = start(program, args, options, ["ignore", "pipe", "pipe"]);
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return { ...(await completion(child)), stderr, stdout };
}

function start(program, args, options, stdio) {
  return spawn(program, args, {
    detached: process.platform !== "win32",
    ...options,
    stdio,
  });
}

function completion(child) {
  return new Promise((resolve, reject) => {
    const forwarded = new Map();
    let escalation;
    let interrupted = null;
    for (const signal of ["SIGINT", "SIGTERM"]) {
      const handler = () => {
        interrupted ??= signal;
        terminateTree(child, signal);
        escalation ??= setTimeout(() => terminateTree(child, "SIGKILL"), 5_000);
      };
      forwarded.set(signal, handler);
      process.once(signal, handler);
    }
    const cleanup = () => {
      for (const [signal, handler] of forwarded)
        process.removeListener(signal, handler);
      if (escalation) clearTimeout(escalation);
    };
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("close", (exitCode, signal) => {
      if (interrupted) terminateTree(child, "SIGKILL");
      cleanup();
      resolve({ exitCode, signal, interrupted });
    });
  });
}

function terminateTree(child, signal) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}
