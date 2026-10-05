/** Short, locked output validation retained with one accepted render generation. */
import type { ResolvedConfig } from "../config/types.js";
import { timeSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import { nonGeneratedOutputFiles } from "./output_collisions.js";
import { withOutputLock } from "./output_lock.js";
import { validateGeneratedOutputPaths } from "./output_paths.js";
import { pendingGeneratedOrphanRoutes } from "./ownership.js";

/** Private immutable evidence; no rendered HTML or resource bytes cross this boundary. */
export interface OutputSnapshot {
  readonly routes: readonly string[];
  readonly orphanRoutes: readonly string[];
}

/** Inspect one stable tree; release its lock before any consumer render can run. */
export async function captureOutputSnapshot(
  routes: Iterable<string>,
  config: ResolvedConfig,
  signal?: AbortSignal,
): Promise<OutputSnapshot> {
  const expected = [...routes].sort();
  return withOutputLock(config.repoRoot, signal ? { signal } : {}, async () =>
    timeSync("output.paths", () => {
      const files = nonGeneratedOutputFiles(config);
      validateGeneratedOutputPaths(expected, config, files);
      return {
        routes: expected,
        orphanRoutes: pendingGeneratedOrphanRoutes(config, expected),
      };
    }),
  );
}

/** Worker renders can only use paths validated by their accepted parent generation. */
export function assertSnapshotRoutes(
  snapshot: OutputSnapshot,
  routes: Iterable<string>,
): void {
  const allowed = new Set(snapshot.routes);
  for (const route of routes)
    if (!allowed.has(route))
      throw new MoklyError(
        "build-invalid",
        `generated route has no accepted output validation: ${route}`,
      );
}

/** Validate the private JSON IPC shape before retaining a generation's evidence. */
export function isOutputSnapshot(value: unknown): value is OutputSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as OutputSnapshot;
  return (
    Object.keys(value).length === 2 &&
    Array.isArray(snapshot.routes) &&
    snapshot.routes.every((route) => typeof route === "string") &&
    Array.isArray(snapshot.orphanRoutes) &&
    snapshot.orphanRoutes.every((route) => typeof route === "string")
  );
}
