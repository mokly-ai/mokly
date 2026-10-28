import type { OnResolveArgs } from "esbuild";

import type { ModulePaths } from "./module-paths.js";
import { bareSpecifier } from "./specifier.js";

/** The module and the esbuild side-effects flag of one planned import. */
export interface PlannedImport {
  path: string;
  sideEffects: boolean;
}

/**
 * How the consumer plugin resolves imports. `native` lets esbuild resolve
 * each import that no base tier remap can change. `planned` returns the
 * classified module of each import that a native compile resolved, keyed by
 * {@link planKey}. `full` resolves every import through the sidecar's own
 * rules with a resolver round trip.
 */
export type Resolution =
  | { mode: "native" }
  | { mode: "planned"; plan: ReadonlyMap<string, PlannedImport> }
  | { mode: "full" };

/** A handled `require` failure ends the native compile like other errors. */
export const nativeLogOverride = { "ignored-dynamic-import": "error" } as const;

/** Only a bare import from a repository-owned file can need the base remap. */
export function nativeImport(
  paths: ModulePaths,
  name: string,
  directory: string,
): boolean {
  return !bareSpecifier(name) || !paths.repositoryOwned(directory);
}

/**
 * The outer resolution of an import can stay native. An inner resolution
 * that another plugin requests, and `require.resolve`, whose target the
 * metafile omits, keep the full path.
 */
export function nativeResolution(
  paths: ModulePaths,
  args: OnResolveArgs,
): boolean {
  return (
    args.pluginData === undefined &&
    args.kind !== "require-resolve" &&
    nativeImport(paths, args.path, args.resolveDir)
  );
}

export function planKey(
  importer: string,
  specifier: string,
  kind: string,
): string {
  return JSON.stringify([importer, specifier, kind]);
}
