import path from "node:path";

import type { Metafile, OnResolveArgs, OnResolveResult } from "esbuild";

import type { PlannedImport } from "../generated/sidecar/PlannedImport.js";
import type { PlannedImportKind } from "../generated/sidecar/PlannedImportKind.js";
import type { ResolutionPlan } from "../generated/sidecar/ResolutionPlan.js";

import { detail, protocol } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { nativeImport, nativeResolveFilter } from "./native-resolution.js";
import { PackageScope } from "./package-scope.js";
import type { PlanCandidates } from "./plan-candidates.js";
import { PlanBuilder } from "./resolution-plan.js";

interface Target {
  path: string;
  sideEffects: boolean;
  /** esbuild's own resolution differs from a resolve callback result. */
  distinct: boolean;
}

/** A native compile that is not final: its plan, or none after a failure. */
export interface NativeOutcome {
  plan?: ResolutionPlan;
}

/** The classified imports of one native compile. */
export interface NativePlan {
  /** The native compile produced the full path's result. */
  exact: boolean;
  plan: ResolutionPlan;
}

/**
 * Classify each native import target as the full path would and plan its
 * result. The native compile is exact when every target maps to itself and
 * esbuild gave none a package type, TypeScript settings, or a fallback path,
 * which a resolve callback result never carries. Only then does the native
 * result stand, so only then are the native imports' dependency lookups
 * recorded. An import that may have taken a fallback path stays unplanned.
 * A relative external edge skipped by the hook makes the result inexact.
 */
export async function planNative(
  metafile: Metafile,
  paths: ModulePaths,
  skippedRelatives = false,
  candidates?: PlanCandidates,
): Promise<NativePlan> {
  const scope = new PackageScope();
  const targets = new Map<string, Promise<Target | undefined>>();
  const target = (file: string) => {
    let found = targets.get(file);
    if (!found) {
      found = classifyNativeTarget(paths, scope, file);
      targets.set(file, found);
    }
    return found;
  };
  const edges: Array<{
    importer: string;
    specifier: string;
    directory: string;
    kind: PlannedImportKind;
    file: string;
    target: Promise<Target | undefined>;
  }> = [];
  let exact = true;
  for (const [file, input] of Object.entries(metafile.inputs)) {
    if (!path.isAbsolute(file)) continue;
    const directory = path.dirname(file);
    for (const edge of input.imports) {
      if (
        skippedRelatives &&
        edge.external &&
        !nativeResolveFilter.test(edge.path)
      )
        exact = false;
      if (edge.external || !path.isAbsolute(edge.path)) continue;
      if (edge.original === undefined) exact = false;
      else if (nativeImport(paths, edge.original, directory))
        edges.push({
          importer: file,
          specifier: edge.original,
          directory,
          kind: edge.kind,
          file: edge.path,
          target: target(edge.path),
        });
    }
  }
  const builder = new PlanBuilder();
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
    candidates?.selected(edge.file);
    builder.addImport(
      edge.importer,
      edge.specifier,
      edge.kind,
      resolved.path,
      resolved.sideEffects,
    );
    usage.push(() =>
      paths.dependencyUsage.resolved(
        edge.specifier,
        edge.directory,
        resolved.path,
      ),
    );
  }
  if (exact) await Promise.all(usage.map((record) => record()));
  return { exact, plan: builder.plan };
}

/** The full path's result for a planned import, without a round trip. */
export async function plannedResult(
  paths: ModulePaths,
  args: OnResolveArgs,
  plan: ResolutionPlan,
  planned: PlannedImport,
): Promise<OnResolveResult> {
  try {
    const file = plan.paths[planned[3]];
    if (file === undefined) protocol("invalid resolution plan reference");
    paths.observe(file);
    await paths.dependencyUsage.resolved(args.path, args.resolveDir, file);
    return { path: file, sideEffects: planned[4] };
  } catch (error) {
    return { errors: [{ text: detail(error) }] };
  }
}

/** A target that the full path rejects stays unplanned, so it reports there. */
export async function classifyNativeTarget(
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
