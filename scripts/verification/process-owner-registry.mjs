import fs from "node:fs/promises";
import path from "node:path";

const OWNER_FILE = /^owner-([0-9a-f-]{36})\.json$/;
const PROCESS_FILE = /^process-([0-9a-f-]{36})\.json$/;

export function assertOwnerId(ownerId) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(ownerId))
    throw new Error("Verification owner identity is invalid");
}

export async function readRegistry(registry) {
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

export function parseOwnerRecord(value, filenameId, file) {
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

export function descendantOwnerIds(owners, rootId) {
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

export function ownerDepth(owners, ownerId) {
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
