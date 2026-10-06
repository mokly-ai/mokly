import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  assertOwnerId,
  descendantOwnerIds,
  ownerDepth,
  parseOwnerRecord,
  readRegistry,
} from "./process-owner-registry.mjs";

const DRAIN_TIMEOUT_MS = 5_000;

export function beginOwnerClosure(registry, ownerId) {
  assertOwnerId(ownerId);
  try {
    fsSync.writeFileSync(closingFile(registry, ownerId), "", {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
}

export async function assertOwnerOpen(registry, ownerId) {
  const visited = new Set();
  let current = ownerId;
  while (current !== null) {
    if (visited.has(current))
      throw new Error(`Verification owner ancestry is cyclic: ${current}`);
    visited.add(current);
    if (await exists(closingFile(registry, current)))
      throw new Error(`Verification process owner is closing: ${current}`);
    const file = path.join(registry, `owner-${current}.json`);
    let value;
    try {
      value = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      throw new Error(
        `Invalid verification ownership record: ${path.basename(file)}`,
        {
          cause: error,
        },
      );
    }
    current = parseOwnerRecord(value, current, file).parentId;
  }
}

export async function writeOwnerRecord(registry, ownerId, parentId) {
  const target = path.join(registry, `owner-${ownerId}.json`);
  const temporary = path.join(
    registry,
    `.owner-${ownerId}-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(
      temporary,
      `${JSON.stringify({
        schemaVersion: 1,
        type: "owner",
        ownerId,
        parentId,
      })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

/** Keep a verifier-spawned process group visible to ancestor cancellation. */
export async function writeProcessRecord(registry, ownerId, processGroupId) {
  assertOwnerId(ownerId);
  if (!Number.isSafeInteger(processGroupId) || processGroupId <= 0)
    throw new Error("Process ownership requires a positive process group ID");
  await assertOwnerOpen(registry, ownerId);
  const identity = randomUUID();
  const target = path.join(registry, `process-${identity}.json`);
  const temporary = path.join(
    registry,
    `.process-${identity}-${process.pid}.tmp`,
  );
  let committed = false;
  try {
    await fs.writeFile(
      temporary,
      `${JSON.stringify({ schemaVersion: 1, type: "process", ownerId, processGroupId })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    await fs.rename(temporary, target);
    committed = true;
    await assertOwnerOpen(registry, ownerId);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    if (committed) await fs.rm(target, { force: true });
    throw error;
  }
}

export async function terminateOwnedProcesses(registry, ownerId, signal) {
  const records = await ownedProcessRecords(registry, ownerId);
  const failures = [];
  for (const record of records) {
    if (!(await exists(record.file))) continue;
    try {
      signalProcessGroup(record.processGroupId, signal);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0)
    throw new AggregateError(
      failures,
      "registered verification process termination failed",
    );
}

export async function drainOwnedProcesses(registry, ownerId) {
  const deadline = Date.now() + DRAIN_TIMEOUT_MS;
  const signalled = new Set();
  while (true) {
    const records = await ownedProcessRecords(registry, ownerId);
    const running = [];
    for (const record of records) {
      if (!processGroupExists(record.processGroupId)) {
        await fs.rm(record.file, { force: true });
        continue;
      }
      running.push(record);
      if (!signalled.has(record.file)) {
        signalProcessGroup(record.processGroupId, "SIGKILL");
        signalled.add(record.file);
      }
    }
    if (running.length === 0) return;
    if (Date.now() >= deadline)
      throw new Error(
        `Registered verification process groups did not drain: ${running
          .map((record) => record.processGroupId)
          .join(", ")}`,
      );
    await delay(25);
  }
}

export async function removeOwnedOwnerRecords(registry, ownerId) {
  const snapshot = await readRegistry(registry);
  const ownerIds = descendantOwnerIds(snapshot.owners, ownerId);
  const owned = snapshot.owners.filter((record) =>
    ownerIds.has(record.ownerId),
  );
  owned.sort(
    (left, right) =>
      ownerDepth(snapshot.owners, right.ownerId) -
      ownerDepth(snapshot.owners, left.ownerId),
  );
  for (const record of owned) await fs.rm(record.file, { force: true });
  await Promise.all(
    owned.map((record) =>
      fs.rm(closingFile(registry, record.ownerId), { force: true }),
    ),
  );
}

export async function assertRealDirectory(directory, label) {
  if (!path.isAbsolute(directory))
    throw new Error(`Inherited verification ${label} must be absolute`);
  const metadata = await fs.lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error(`Inherited verification ${label} must be a real directory`);
}

async function ownedProcessRecords(registry, ownerId) {
  const snapshot = await readRegistry(registry);
  const ownerIds = descendantOwnerIds(snapshot.owners, ownerId);
  return snapshot.processes.filter((record) => ownerIds.has(record.ownerId));
}

function closingFile(registry, ownerId) {
  return path.join(registry, `closing-${ownerId}`);
}

function signalProcessGroup(processGroupId, signal) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(processGroupId), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(-processGroupId, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function processGroupExists(processGroupId) {
  try {
    process.kill(
      process.platform === "win32" ? processGroupId : -processGroupId,
      0,
    );
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
