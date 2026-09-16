import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { BaselineError } from "./errors.js";

export const BASELINE_CACHE_PATH = ".mokly-cache/baselines";
export const DEFAULT_RETAINED_COUNT = 3;
export const LOCK_TIMEOUT_MS = 120_000;
export const LOCK_POLL_MS = 100;
export const MAX_MARKER_BYTES = 1024 * 1024;

/** Written only after output adoption and removal of the source extraction. */
export interface CompletionMarker {
  readonly schemaVersion: 1;
  readonly commit: string;
  readonly finishedAt: string;
  readonly commands: readonly (readonly string[])[];
  readonly manifestVersion: 2 | 3 | 4 | 5;
}

export interface CacheLayout {
  readonly root: string;
  readonly entry: string;
  readonly source: string;
  readonly output: string;
  readonly marker: string;
  readonly lock: string;
}

export function cacheLayout(repoRoot: string, commit: string): CacheLayout {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit))
    throw new BaselineError(
      "baseline-history-unavailable",
      `Invalid baseline commit: ${commit}`,
    );
  const root = path.join(repoRoot, BASELINE_CACHE_PATH);
  const entry = path.join(root, commit);
  return {
    root,
    entry,
    source: path.join(entry, "source"),
    output: path.join(entry, "output"),
    marker: path.join(entry, "complete.json"),
    lock: path.join(entry, "lock"),
  };
}

export function assertMockupsPath(value: string): void {
  if (
    !isSafeRepositoryPath(value) ||
    value === ".mokly-cache" ||
    value.startsWith(".mokly-cache/")
  )
    throw new BaselineError(
      "baseline-output-invalid",
      `Unsafe baseline output path: ${value}`,
    );
}

export function validCommands(
  value: unknown,
): value is readonly (readonly string[])[] {
  return (
    Array.isArray(value) &&
    value.every(
      (argv: unknown) =>
        Array.isArray(argv) &&
        argv.length > 0 &&
        argv.every(
          (arg: unknown) => typeof arg === "string" && !arg.includes("\0"),
        ) &&
        typeof argv[0] === "string" &&
        argv[0].trim().length > 0,
    )
  );
}

export function parseCompletionMarker(
  value: unknown,
  commit: string,
): CompletionMarker | undefined {
  if (!value || typeof value !== "object") return;
  const marker = value as Partial<CompletionMarker>;
  if (
    marker.schemaVersion !== 1 ||
    marker.commit !== commit ||
    typeof marker.finishedAt !== "string" ||
    !Number.isFinite(Date.parse(marker.finishedAt)) ||
    !validCommands(marker.commands) ||
    ![2, 3, 4, 5].includes(marker.manifestVersion ?? 0)
  )
    return;
  return marker as CompletionMarker;
}
