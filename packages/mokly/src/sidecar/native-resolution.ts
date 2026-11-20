import type { OnResolveArgs } from "esbuild";

import type { ModulePaths } from "./module-paths.js";
import type { PlanLookup } from "./resolution-plan.js";
import { bareSpecifier } from "./specifier.js";

/**
 * How the consumer plugin resolves imports. `native` lets esbuild resolve
 * each import that no base tier remap can change. `planned` returns the
 * classified module of each import that a native compile resolved, through
 * its indexed plan. `full` resolves every import through the sidecar's own
 * rules with a resolver round trip.
 */
export type Resolution =
  { mode: "native" } | { mode: "planned"; plan: PlanLookup } | { mode: "full" };

/** A handled `require` failure ends the native compile like other errors. */
export const nativeLogOverride = { "ignored-dynamic-import": "error" } as const;

/** An uncaptured native hook leaves relative strings to esbuild. */
export const nativeResolveFilter = /^(?:$|[^.]|\.[^./\\]|\.\.[^/\\])/;

/** Only a bare import from a repository-owned file can need the base remap. */
export function nativeImport(
  paths: ModulePaths,
  name: string,
  directory: string,
): boolean {
  return !bareSpecifier(name) || !paths.repositoryOwned(directory);
}

/**
 * An import that reaches the consumer hook can stay native. An inner resolution
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

/** Identify an outer callback answer independently of the indexed plan table. */
export function importCallbackKey(
  importer: string,
  specifier: string,
  kind: OnResolveArgs["kind"],
): string {
  return JSON.stringify([importer, specifier, kind]);
}
