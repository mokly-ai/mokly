import { spawn, spawnSync } from "node:child_process";

import { createVerificationProcessOwner } from "./process-owner.mjs";

export async function runInherited(program, args, options = {}) {
  const { child, owner, settled } = await startOwned(
    program,
    args,
    options,
    "inherit",
  );
  return await completion(child, owner, settled, options.abortSignal);
}

export async function runCaptured(program, args, options = {}) {
  const { child, owner, settled } = await startOwned(program, args, options, [
    "ignore",
    "pipe",
    "pipe",
  ]);
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return {
    ...(await completion(child, owner, settled, options.abortSignal)),
    stderr,
    stdout,
  };
}

async function startOwned(program, args, options, stdio) {
  const owner = await createVerificationProcessOwner(options);
  let child;
  let settled;
  try {
    child = spawn(program, args, {
      detached: process.platform !== "win32",
      cwd: options.cwd,
      env: owner.environment(options.env ?? process.env),
      stdio,
    });
    settled = childOutcome(child);
    if (child.pid) await owner.registerProcessGroup(child.pid);
    else await settled;
    return { child, owner, settled };
  } catch (error) {
    if (child) terminateTree(child, "SIGKILL");
    await settled?.catch(() => {});
    try {
      await owner.dispose();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "verification process launch and cleanup failed",
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

async function completion(child, owner, settled, abortSignal) {
  const forwarded = new Map();
  let escalation;
  let interrupted = null;
  let ownershipFailure;
  let termination = Promise.resolve();
  const terminate = (signal) => {
    try {
      terminateTree(child, signal);
    } catch (error) {
      ownershipFailure ??= error;
    }
    termination = termination
      .then(() => owner.terminate(signal))
      .catch((error) => {
        ownershipFailure ??= error;
      });
  };
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => {
      interrupted ??= signal;
      terminate(signal);
      escalation ??= setTimeout(() => terminate("SIGKILL"), 5_000);
    };
    forwarded.set(signal, handler);
    process.once(signal, handler);
  }
  const abort = () => {
    if (interrupted) return;
    interrupted = "abort";
    terminate("SIGTERM");
    escalation ??= setTimeout(() => terminate("SIGKILL"), 5_000);
  };
  abortSignal?.addEventListener("abort", abort, { once: true });
  if (abortSignal?.aborted) abort();
  let outcome;
  let processFailure;
  try {
    outcome = await settled;
  } catch (error) {
    processFailure = error;
  }
  if (escalation) {
    clearTimeout(escalation);
    escalation = undefined;
  }
  terminate("SIGKILL");
  await termination;
  try {
    await owner.dispose();
  } catch (error) {
    ownershipFailure ??= error;
  }
  for (const [signal, handler] of forwarded)
    process.removeListener(signal, handler);
  abortSignal?.removeEventListener("abort", abort);
  if (escalation) clearTimeout(escalation);
  if (processFailure && ownershipFailure)
    throw new AggregateError(
      [processFailure, ownershipFailure],
      "verification process and ownership cleanup failed",
      { cause: ownershipFailure },
    );
  if (processFailure) throw processFailure;
  if (ownershipFailure) throw ownershipFailure;
  return { ...outcome, interrupted };
}

function childOutcome(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
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
