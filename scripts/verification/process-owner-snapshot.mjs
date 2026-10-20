import fs from "node:fs/promises";

/** @typedef {{file: string, ownerId: string, parentId: string | null}} OwnerRecord */
/** @typedef {{file: string, ownerId: string, processGroupId: number}} ProcessRecord */

/**
 * Cleanup removes process records before owners, and child owners before
 * parents. A scan can retain a child's bytes after its parent disappears.
 * Discard that observation only when the child file is also gone. A record
 * still on disk with broken ancestry remains an error and keeps resources.
 * This checks the sampled graph once; it does not retry the registry scan.
 * @param {OwnerRecord[]} owners
 * @param {ProcessRecord[]} processes
 */
export async function validateRegistrySnapshot(owners, processes) {
  const byId = new Map(owners.map((owner) => [owner.ownerId, owner]));
  const retainedOwners = [];
  for (const owner of owners) {
    const missing = missingParent(byId, owner);
    if (missing === undefined) retainedOwners.push(owner);
    else
      await requireRemoved(
        owner.file,
        `Verification owner ${missing} has no parent`,
      );
  }
  const ownerIds = new Set(retainedOwners.map((owner) => owner.ownerId));
  const retainedProcesses = [];
  for (const record of processes) {
    if (ownerIds.has(record.ownerId)) retainedProcesses.push(record);
    else
      await requireRemoved(
        record.file,
        `Verification process ${record.processGroupId} has no owner`,
      );
  }
  return { owners: retainedOwners, processes: retainedProcesses };
}

/**
 * Check the whole ancestry, so a vanished parent also excludes its sampled
 * descendants. A cycle is invalid even when its records are disappearing.
 * @param {Map<string, OwnerRecord>} owners
 * @param {OwnerRecord} owner
 * @returns {string | undefined}
 */
function missingParent(owners, owner) {
  const visited = new Set();
  let current = owner;
  while (true) {
    if (visited.has(current.ownerId))
      throw new Error(
        `Verification owner ancestry is cyclic: ${current.ownerId}`,
      );
    visited.add(current.ownerId);
    if (current.parentId === null) return;
    const parent = owners.get(current.parentId);
    if (!parent) return current.ownerId;
    current = parent;
  }
}

/** Only a completed removal proves that a sampled orphan is stale.
 * @param {string} file
 * @param {string} message
 */
async function requireRemoved(file, message) {
  try {
    await fs.access(file);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}
