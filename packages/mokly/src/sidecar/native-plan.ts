import path from "node:path";

import type { Metafile, OnResolveArgs, OnResolveResult } from "esbuild";

import { detail } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { nativeImport, planKey } from "./native-resolution.js";
import type { PlannedImport } from "./native-resolution.js";
import { PackageScope } from "./package-scope.js";

interface Target extends PlannedImport {
  /** esbuild's own resolution differs from a resolve callback result. */
  distinct: boolean;
}

/** The classified imports of one native compile. */
export interface NativePlan {
  /** The native compile produced the full path's result. */
  exact: boolean;
  imports: Map<string, PlannedImport>;
}

/**
 * Classify each native import target as the full path would and plan its
 * result. The native compile is exact when every target maps to itself and
 * esbuild gave none a package type, TypeScript settings, or a fallback path,
 * which a resolve callback result never carries. Only then does the native
 * result stand, so only then are the native imports' dependency lookups
 * recorded. An import that may have taken a fallback path stays unplanned.
 */
export async function planNative(
  metafile: Metafile | undefined,
  paths: ModulePaths,
): Promise<NativePlan> {
  if (!metafile) throw new Error("the native compile returned no metafile");
  const scope = new PackageScope();
  const targets = new Map<string, Promise<Target | undefined>>();
  const target = (file: string) => {
    let found = targets.get(file);
    if (!found) {
      found = classify(paths, scope, file);
      targets.set(file, found);
    }
    return found;
  };
  const edges: Array<{
    key: string;
    specifier: string;
    directory: string;
    kind: string;
    file: string;
    target: Promise<Target | undefined>;
  }> = [];
  let exact = true;
  for (const [file, input] of Object.entries(metafile.inputs)) {
    if (!path.isAbsolute(file)) continue;
    const directory = path.dirname(file);
    for (const edge of input.imports) {
      if (edge.external || !path.isAbsolute(edge.path)) continue;
      if (edge.original === undefined) exact = false;
      else if (nativeImport(paths, edge.original, directory))
        edges.push({
          key: planKey(file, edge.original, edge.kind),
          specifier: edge.original,
          directory,
          kind: edge.kind,
          file: edge.path,
          target: target(edge.path),
        });
    }
  }
  const imports = new Map<string, PlannedImport>();
  const usage: Array<() => Promise<void>> = [];
  const automaticMain = paths.settings.mainFields.length === 0;
  for (const edge of edges) {
    const resolved = await edge.target;
    if (!resolved || resolved.distinct) exact = false;
    if (
      !resolved ||
      (automaticMain &&
        edge.kind !== "require-call" &&
        (await scope.moduleFallback(edge.file)))
    ) {
      exact = false;
      continue;
    }
    imports.set(edge.key, {
      path: resolved.path,
      sideEffects: resolved.sideEffects,
    });
    usage.push(() =>
      paths.dependencyUsage.resolved(
        edge.specifier,
        edge.directory,
        resolved.path,
      ),
    );
  }
  if (exact) await Promise.all(usage.map((record) => record()));
  return { exact, imports };
}

/** The full path's result for a planned import, without a round trip. */
export async function plannedResult(
  paths: ModulePaths,
  args: OnResolveArgs,
  planned: PlannedImport,
): Promise<OnResolveResult> {
  try {
    paths.observe(planned.path);
    await paths.dependencyUsage.resolved(
      args.path,
      args.resolveDir,
      planned.path,
    );
    return { path: planned.path, sideEffects: planned.sideEffects };
  } catch (error) {
    return { errors: [{ text: detail(error) }] };
  }
}

/** A target that the full path rejects stays unplanned, so it reports there. */
async function classify(
  paths: ModulePaths,
  scope: PackageScope,
  file: string,
): Promise<Target | undefined> {
  try {
    const resolved = await paths.resolve(file);
    return {
      path: resolved,
      sideEffects: await scope.sideEffects(file),
      distinct: resolved !== file || (await scope.parseSettings(file)),
    };
  } catch {
    return undefined;
  }
}
