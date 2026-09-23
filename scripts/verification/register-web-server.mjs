import {
  assertOwnerId,
  assertRealDirectory,
  writeProcessRecord,
} from "./process-owner-records.mjs";

const ownerId = process.env.MOKLY_VERIFICATION_OWNER_ID;
const registry = process.env.MOKLY_VERIFICATION_PROCESS_REGISTRY;
const resourceRoot = process.env.MOKLY_VERIFICATION_RESOURCE_ROOT;

if (ownerId || registry || resourceRoot) {
  if (!ownerId || !registry || !resourceRoot)
    throw new Error("Browser server verification ownership is incomplete");
  assertOwnerId(ownerId);
  await Promise.all([
    assertRealDirectory(registry, "process registry"),
    assertRealDirectory(resourceRoot, "resource root"),
  ]);
  await writeProcessRecord(registry, ownerId, process.pid);
}
