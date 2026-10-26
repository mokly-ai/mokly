import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter, once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";

import { childEnvironment } from "./child-environment.mjs";
import { captureProcessGroups } from "./process-groups.mjs";
import { assertOwnerOpen } from "./process-owner-records.mjs";
import { createVerificationProcessOwner } from "./process-owner.mjs";

/** A suspended Node command registered before its worker is released. */
async function commandProcess(args, cwd, environment = process.env) {
  const owner = await createVerificationProcessOwner({ cwd, env: environment });
  const env = owner.environment(childEnvironment(environment));
  const child = spawn(
    process.execPath,
    [path.join(import.meta.dirname, "serve-process-worker.mjs")],
    {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  const registry = env.MOKLY_VERIFICATION_PROCESS_REGISTRY;
  const ownerId = env.MOKLY_VERIFICATION_OWNER_ID;
  const signal = (value) => {
    if (!child.pid) return;
    captureProcessGroups(registry, [{ ownerId, processGroupId: child.pid }]);
    if (value === "SIGINT") {
      child.kill(value);
      return;
    }
    if (process.platform === "win32") {
      if (value === "SIGKILL")
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      else child.kill(value);
      return;
    }
    try {
      process.kill(-child.pid, value);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  try {
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    const file = path.join(registry, `process-${randomUUID()}.json`);
    const temporary = `${file}.tmp`;
    await assertOwnerOpen(registry, ownerId);
    await fs.writeFile(
      temporary,
      JSON.stringify({
        schemaVersion: 1,
        type: "process",
        ownerId,
        processGroupId: child.pid,
      }),
      { flag: "wx", mode: 0o600 },
    );
    await fs.rename(temporary, file);
    await assertOwnerOpen(registry, ownerId);
    return {
      child,
      signal,
      start: () =>
        new Promise((resolve, reject) =>
          child.send({ args }, (error) => (error ? reject(error) : resolve())),
        ),
      drain: () => owner.dispose(),
    };
  } catch (error) {
    signal("SIGKILL");
    try {
      await owner.dispose();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Command registration and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
}

/** A suspended, registered Serve process scope shared with the outer wrapper. */
export function serveProcess(args, cwd, environment = process.env) {
  return commandProcess(args, cwd, { ...environment, MOKLY_OUTPUT: "plain" });
}

/** A complete listening line prevents returning a partial port. */
export function listeningAddress(output) {
  return /(?:^|\n)Mokly listening at (http:\/\/127\.0\.0\.1:\d+)(?: \(watching\))?\r?\n/.exec(
    output,
  )?.[1];
}

/** Start a registered Serve scope. Attach cleanup before waiting for readiness. */
export async function startServe(args, { cwd, env = {} }) {
  const managed = await serveProcess(args, cwd, { ...process.env, ...env });
  const { child } = managed;
  const events = new EventEmitter();
  let output = "";
  let stderr = "";
  let failure;
  const closed = new Promise((resolve) => {
    child.once("error", (error) => {
      failure = error;
      events.emit("output");
      resolve();
    });
    child.once("close", () => {
      events.emit("output");
      resolve();
    });
  });
  child.stdout.on("data", (chunk) => {
    output += chunk;
    events.emit("output");
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
    stderr += chunk;
    events.emit("output");
  });
  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
    child.once("error", resolve);
  });
  let stopping;
  const stop = () =>
    (stopping ??= (async () => {
      if (child.exitCode === null && child.signalCode === null)
        managed.signal("SIGINT");
      let escalationFailure;
      const guard = setTimeout(() => {
        try {
          managed.signal("SIGKILL");
        } catch (error) {
          escalationFailure = error;
        }
      }, 10_000);
      try {
        if (child.exitCode === null && child.signalCode === null) await exited;
      } finally {
        clearTimeout(guard);
      }
      await managed.drain();
      await closed;
      if (failure || escalationFailure) throw failure ?? escalationFailure;
      return { code: child.exitCode, signal: child.signalCode };
    })());
  try {
    await managed.start();
  } catch (error) {
    try {
      await stop();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Serve startup and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
  return {
    child,
    stop,
    stderr: () => stderr,
    diagnostics: () => output,
    async listening(signal) {
      for (;;) {
        signal.throwIfAborted();
        const url = listeningAddress(output);
        if (url) return url;
        if (failure || child.exitCode !== null || child.signalCode !== null)
          throw new Error(`Serve stopped before it listened:\n${output}`, {
            cause: failure,
          });
        await once(events, "output", { signal });
      }
    },
  };
}

/** Start `node {shim} serve {args}` through the shared suspended worker. */
export function spawnServe(shim, args, options) {
  return startServe([shim, "serve", ...args], options);
}
