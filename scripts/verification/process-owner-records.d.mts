/** Fail when the owner or one of its ancestors is closing or missing. */
export function assertOwnerOpen(
  registry: string,
  ownerId: string,
): Promise<void>;

/** Write the owner record atomically under the registry. */
export function writeOwnerRecord(
  registry: string,
  ownerId: string,
  parentId: string | null,
): Promise<void>;
