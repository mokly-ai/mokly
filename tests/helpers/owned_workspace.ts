import fs from "node:fs/promises";

/** Dependent resource that must close before a fixture workspace is removed. */
export type FixtureCleanup = () => Promise<void> | void;

/** Cleanup ownership shared by synthetic and design-library workspaces. */
export interface OwnedWorkspace {
  /** Register dependent cleanup in last-created, first-closed order. */
  beforeRemove(cleanup: FixtureCleanup): void;
  /** Drain registered dependents once, then remove the workspace. */
  remove(): Promise<void>;
}

/** Retain the workspace if any dependent cleanup fails. */
export function ownedWorkspace(root: string): OwnedWorkspace {
  const cleanups: FixtureCleanup[] = [];
  let removal: Promise<void> | undefined;
  return {
    beforeRemove(cleanup) {
      if (removal)
        throw new Error("cannot register cleanup after fixture removal starts");
      cleanups.push(cleanup);
    },
    remove() {
      removal ??= removeOwnedWorkspace(root, cleanups);
      return removal;
    },
  };
}

async function removeOwnedWorkspace(
  root: string,
  cleanups: readonly FixtureCleanup[],
): Promise<void> {
  const failures: unknown[] = [];
  for (const cleanup of [...cleanups].reverse()) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "fixture dependent cleanup failed");
  await fs.rm(root, { force: true, recursive: true });
}
