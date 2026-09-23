import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DRAIN_TIMEOUT_MS = 5_000;
const OWNER_FILE = /^owner-([0-9a-f-]{36})\.json$/;
const PROCESS_FILE = /^process-([0-9a-f-]{36})\.json$/;

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

export function assertOwnerId(ownerId) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(ownerId))
    throw new Error("Verification owner identity is invalid");
}

async function ownedProcessRecords(registry, ownerId) {
  const snapshot = await readRegistry(registry);
  const ownerIds = descendantOwnerIds(snapshot.owners, ownerId);
  return snapshot.processes.filter((record) => ownerIds.has(record.ownerId));
}

async function readRegistry(registry) {
  const owners = [];
  const processes = [];
  for (const name of await fs.readdir(registry)) {
    const ownerMatch = OWNER_FILE.exec(name);
    const processMatch = PROCESS_FILE.exec(name);
    if (!ownerMatch && !processMatch) continue;
    const file = path.join(registry, name);
    let value;
    try {
      value = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error(`Invalid verification ownership record: ${name}`, {
        cause: error,
      });
    }
    if (ownerMatch) owners.push(parseOwnerRecord(value, ownerMatch[1], file));
    else processes.push(parseProcessRecord(value, file));
  }
  const ownerIds = new Set(owners.map((record) => record.ownerId));
  for (const owner of owners) {
    if (owner.parentId !== null && !ownerIds.has(owner.parentId))
      throw new Error(`Verification owner ${owner.ownerId} has no parent`);
  }
  for (const record of processes) {
    if (!ownerIds.has(record.ownerId))
      throw new Error(
        `Verification process ${record.processGroupId} has no owner`,
      );
  }
  for (const owner of owners) ownerDepth(owners, owner.ownerId);
  return { owners, processes };
}

function parseOwnerRecord(value, filenameId, file) {
  if (
    value?.schemaVersion !== 1 ||
    value.type !== "owner" ||
    value.ownerId !== filenameId ||
    (value.parentId !== null && typeof value.parentId !== "string") ||
    value.parentId === value.ownerId
  )
    throw new Error(
      `Invalid verification owner record: ${path.basename(file)}`,
    );
  assertOwnerId(value.ownerId);
  if (value.parentId !== null) assertOwnerId(value.parentId);
  return { file, ownerId: value.ownerId, parentId: value.parentId };
}

function parseProcessRecord(value, file) {
  if (
    value?.schemaVersion !== 1 ||
    value.type !== "process" ||
    typeof value.ownerId !== "string" ||
    !Number.isSafeInteger(value.processGroupId) ||
    value.processGroupId <= 0
  )
    throw new Error(
      `Invalid verification process record: ${path.basename(file)}`,
    );
  assertOwnerId(value.ownerId);
  return {
    file,
    ownerId: value.ownerId,
    processGroupId: value.processGroupId,
  };
}

function descendantOwnerIds(owners, rootId) {
  if (!owners.some((owner) => owner.ownerId === rootId))
    throw new Error(`Verification owner is missing: ${rootId}`);
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const owner of owners) {
      if (!ids.has(owner.ownerId) && ids.has(owner.parentId)) {
        ids.add(owner.ownerId);
        changed = true;
      }
    }
  }
  return ids;
}

function ownerDepth(owners, ownerId) {
  const byId = new Map(owners.map((owner) => [owner.ownerId, owner]));
  const visited = new Set();
  let current = ownerId;
  let depth = 0;
  while (current !== null) {
    if (visited.has(current))
      throw new Error(`Verification owner ancestry is cyclic: ${current}`);
    visited.add(current);
    const owner = byId.get(current);
    if (!owner) throw new Error(`Verification owner is missing: ${current}`);
    current = owner.parentId;
    depth += 1;
  }
  return depth;
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
