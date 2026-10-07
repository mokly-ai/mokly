import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { MOKLY_CACHE } from "../config/cache_paths.js";

import { BaselineError } from "./errors.js";

export const DEFAULT_RETAINED_COUNT = 3;
export const LOCK_TIMEOUT_MS = 120_000;
export const LOCK_POLL_MS = 100;
export const MAX_MARKER_BYTES = 1024 * 1024;

/** Written only after output adoption and removal of the source extraction. */
export interface CompletionMarker {
  readonly schemaVersion: 2;
  readonly commit: string;
  readonly finishedAt: string;
  readonly commands: readonly (readonly string[])[];
  readonly manifestVersion: 9;
  readonly historicalCatalogueRoot: string;
  readonly layout: "generated-v9";
}

export interface CacheLayout {
  /** The repository's `.mokly-cache/` directory, which holds `root`. */
  readonly cache: string;
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
  const cache = path.join(repoRoot, MOKLY_CACHE);
  const root = path.join(cache, "baselines");
  const entry = path.join(root, commit);
  return {
    cache,
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
    (value !== "." && !isSafeRepositoryPath(value)) ||
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
    marker.schemaVersion !== 2 ||
    marker.commit !== commit ||
    typeof marker.finishedAt !== "string" ||
    !Number.isFinite(Date.parse(marker.finishedAt)) ||
    !validCommands(marker.commands) ||
    marker.manifestVersion !== 9 ||
    marker.layout !== "generated-v9" ||
    typeof marker.historicalCatalogueRoot !== "string" ||
    (marker.historicalCatalogueRoot !== "." &&
      !isSafeRepositoryPath(marker.historicalCatalogueRoot))
  )
    return;
  return marker as CompletionMarker;
}

/** A completion temporary belongs to the entry's exclusive writer. */
export function isCompletionTemporary(name: string): boolean {
  return /^complete-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.tmp$/.test(
    name,
  );
}
