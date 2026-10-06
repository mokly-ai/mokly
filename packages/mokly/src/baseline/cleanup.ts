import path from "node:path";

import {
  cacheLayout,
  MAX_MARKER_BYTES,
  parseCompletionMarker,
  type CacheLayout,
} from "./cache_layout.js";
import { tryBaselineLock } from "./lock.js";
import type { BaselineMaintenanceFailure } from "./maintenance.js";
import type {
  BaselineBuildRequest,
  BaselineClock,
  BaselineFileSystem,
  BaselineProcessRunner,
} from "./types.js";

/** Retain the newest completed commits; active or locked entries are never removed. */
export async function cleanupBaselines(
  fs: BaselineFileSystem,
  runner: BaselineProcessRunner,
  clock: BaselineClock,
  active: CacheLayout,
  request: BaselineBuildRequest,
  retained: number,
): Promise<readonly BaselineMaintenanceFailure[]> {
  const failures: BaselineMaintenanceFailure[] = [];
  if (request.signal?.aborted) return failures;
  let candidates: readonly string[];
  try {
    candidates = await fs.list(active.root);
  } catch (error) {
    return [{ entry: active.root, error }];
  }
  const entries: { layout: CacheLayout; finishedAt: number }[] = [];
  for (const commit of candidates) {
    if (request.signal?.aborted) return failures;
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) continue;
    const layout = cacheLayout(request.repoRoot, commit);
    try {
      if ((await fs.stat(layout.entry))?.kind !== "directory") continue;
      if ((await fs.stat(layout.marker))?.kind !== "regular") continue;
      const marker = parseCompletionMarker(
        JSON.parse(
          Buffer.from(await fs.read(layout.marker, MAX_MARKER_BYTES)).toString(
            "utf8",
          ),
        ),
        commit,
      );
      if (marker)
        entries.push({ layout, finishedAt: Date.parse(marker.finishedAt) });
    } catch (error) {
      failures.push({ entry: layout.entry, error });
    }
  }
  entries.sort(
    (a, b) =>
      b.finishedAt - a.finishedAt ||
      b.layout.entry.localeCompare(a.layout.entry),
  );
  let kept = 1;
  for (const { layout } of entries) {
    if (request.signal?.aborted) break;
    if (layout.entry === active.entry) continue;
    if (kept++ < retained) continue;
    try {
      const lock = await tryBaselineLock(fs, runner, clock, layout);
      if (!lock) continue;
      const trash = path.join(
        active.entry,
        `discard-${path.basename(layout.entry)}`,
      );
      try {
        if (request.signal?.aborted) break;
        await fs.rename(layout.entry, trash);
        await fs.remove(trash);
      } catch (error) {
        failures.push({ entry: layout.entry, error });
      } finally {
        try {
          await lock.release();
        } catch (error) {
          failures.push({ entry: layout.lock, error });
        }
      }
    } catch (error) {
      failures.push({ entry: layout.entry, error });
    }
  }
  return failures;
}
