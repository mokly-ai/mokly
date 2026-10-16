import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { childEnvironment } from "./child-environment.mjs";
import { assertOwnerOpen } from "./process-owner-records.mjs";
import { createVerificationProcessOwner } from "./process-owner.mjs";

/** A suspended, registered Serve process scope shared with the outer wrapper. */
export async function serveProcess(args, cwd) {
  const owner = await createVerificationProcessOwner({ cwd, env: process.env });
  const env = owner.environment({
    ...childEnvironment(),
    MOKLY_OUTPUT: "plain",
  });
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
  const signal = (value) => {
    if (!child.pid) return;
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
    const registry = env.MOKLY_VERIFICATION_PROCESS_REGISTRY;
    const ownerId = env.MOKLY_VERIFICATION_OWNER_ID;
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
        "Serve registration and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
}
