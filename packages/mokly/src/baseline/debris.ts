import path from "node:path";

import type { CacheLayout } from "./cache_layout.js";
import type { BaselineMaintenanceFailure } from "./maintenance.js";
import type { BaselineFileSystem, BaselineProcessRunner } from "./types.js";

/** Called under the entry lock; reclamation tombstones remain until the whole entry is retired. */
export async function removeBaselineDebris(
  fs: BaselineFileSystem,
  runner: BaselineProcessRunner,
  layout: CacheLayout,
): Promise<readonly BaselineMaintenanceFailure[]> {
  const failures: BaselineMaintenanceFailure[] = [];
  let names: readonly string[];
  try {
    names = await fs.list(layout.entry);
  } catch (error) {
    return [{ entry: layout.entry, error }];
  }
  for (const name of names) {
    const discard = /^discard-(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(name);
    const pid =
      /^\.lock-([1-9][0-9]*)-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.exec(
        name,
      )?.[1];
    if (!discard && !pid) continue;
    const entry = path.join(layout.entry, name);
    try {
      if (
        pid &&
        (!Number.isSafeInteger(Number(pid)) || runner.isAlive(Number(pid)))
      )
        continue;
      const stat = await fs.stat(entry);
      if (stat?.kind === "regular" || (discard && stat?.kind === "directory"))
        await fs.remove(entry);
    } catch (error) {
      failures.push({ entry, error });
    }
  }
  return failures;
}
