/** Immutable route acceptance shared by one in-memory render generation. */
import { isSafeRepositoryPath } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { validateGeneratedOutputPaths } from "./output_paths.js";

export interface OutputSnapshot {
  readonly schemaVersion: 1;
  readonly routes: readonly string[];
}

/** Capture checked candidate routes without reading output or acquiring a writer lock. */
export async function captureOutputSnapshot(
  routes: Iterable<string>,
  config: ResolvedConfig,
  signal?: AbortSignal,
): Promise<OutputSnapshot> {
  signal?.throwIfAborted();
  const expected = [...routes].sort();
  validateGeneratedOutputPaths(expected, config);
  return Object.freeze({ schemaVersion: 1, routes: Object.freeze(expected) });
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

/** Reject unknown versions, unsafe routes and noncanonical private IPC records. */
export function isOutputSnapshot(value: unknown): value is OutputSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as OutputSnapshot;
  if (!(
    Object.keys(value).length === 2 &&
    snapshot.schemaVersion === 1 &&
    Array.isArray(snapshot.routes) &&
    snapshot.routes.every(
      (route, index) =>
        typeof route === "string" &&
        isSafeRepositoryPath(route) &&
        (index === 0 || snapshot.routes[index - 1]! < route),
    ) &&
    new Set(snapshot.routes.map((route) => route.toLowerCase())).size ===
      snapshot.routes.length
  ))
    return false;
  const routes = new Set(snapshot.routes.map((route) => route.toLowerCase()));
  return snapshot.routes.every((route: string) => {
    const parts: string[] = route.toLowerCase().split("/");
    return parts.every(
      (_, index) => index === 0 || !routes.has(parts.slice(0, index).join("/")),
    );
  });
}
