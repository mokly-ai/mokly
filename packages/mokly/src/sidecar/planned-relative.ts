import path from "node:path";

import type { Metafile } from "esbuild";

import type { PlannedImport } from "../generated/sidecar/PlannedImport.js";

import { MetadataProof, metadataRuntime } from "./metadata-proof.js";
import type { ModulePaths } from "./module-paths.js";
import { classifyNativeTarget } from "./native-plan.js";
import { importCallbackKey } from "./native-resolution.js";
import { PackageScope } from "./package-scope.js";
import type { PlanLookup } from "./resolution-plan.js";
import { specifierFilter } from "./specifier-filter.js";

/** The planned relative strings that can use esbuild's own resolution. */
export class PlannedRelative {
  readonly handled = new Set<string>();

  private constructor(
    readonly filters: readonly RegExp[],
    private readonly skipped: ReadonlySet<string>,
    private readonly plan: PlanLookup,
    private readonly scope: PackageScope,
    private readonly metadata: MetadataProof,
  ) {}

  static async create(
    plan: PlanLookup,
    started = metadataRuntime.now(),
  ): Promise<PlannedRelative | undefined> {
    const candidates = new Map<string, PlannedImport[]>();
    for (const target of plan.plan.imports) {
      const name = target[1];
      if (!relative(name)) continue;
      const files = candidates.get(name) ?? [];
      files.push(target);
      candidates.set(name, files);
    }
    const scope = new PackageScope();
    const settings = new Map<string, Promise<boolean | undefined>>();
    const safe = new Map<string, number>();
    for (const [name, files] of candidates) {
      let distinct = false;
      for (const target of files) {
        const file = plan.plan.paths[target[3]]!;
        let parsed = settings.get(file);
        if (!parsed) {
          parsed = scope
            .parseSettings(file)
            .then((distinct) =>
              distinct ? undefined : scope.sideEffects(file),
            );
          settings.set(file, parsed);
        }
        if ((await parsed) !== target[4]) {
          distinct = true;
          break;
        }
      }
      if (!distinct) safe.set(name, files.length);
    }
    const { filters, skipped } = specifierFilter(safe);
    return skipped.size
      ? new PlannedRelative(
          filters,
          skipped,
          plan,
          scope,
          new MetadataProof(started),
        )
      : undefined;
  }

  /** Prove skipped edges before recording their full-path observations. */
  async verify(metafile: Metafile, paths: ModulePaths): Promise<boolean> {
    const observed: Array<{ name: string; directory: string; file: string }> =
      [];
    const targets = new Map<string, ReturnType<typeof classifyNativeTarget>>();
    const directories = new Set<string>();
    for (const [importer, input] of Object.entries(metafile.inputs)) {
      if (!path.isAbsolute(importer)) continue;
      const directory = path.dirname(importer);
      for (const edge of input.imports) {
        if (edge.external && this.skipped.has(edge.path)) return false;
        if (
          edge.external &&
          relative(edge.path) &&
          (edge.kind === "require-resolve" || edge.kind === "require-call") &&
          !this.handled.has(importCallbackKey(importer, edge.path, edge.kind))
        )
          return false;
        if (edge.external || !path.isAbsolute(edge.path)) continue;
        if (edge.original === undefined) return false;
        if (!relative(edge.original)) continue;
        const key = importCallbackKey(importer, edge.original, edge.kind);
        if (this.handled.has(key)) continue;
        if (edge.kind === "require-resolve") return false;
        const planned = this.plan.get(importer, edge.original, edge.kind);
        if (planned && this.plan.plan.paths[planned[3]] !== edge.path)
          return false;
        if (!planned || !this.skipped.has(edge.original)) {
          let target = targets.get(edge.path);
          if (!target) {
            target = classifyNativeTarget(paths, this.scope, edge.path);
            targets.set(edge.path, target);
          }
          const resolved = await target;
          if (
            !resolved ||
            resolved.distinct ||
            (planned && resolved.sideEffects !== planned[4]) ||
            (paths.settings.mainFields.length === 0 &&
              edge.kind !== "require-call" &&
              (await this.scope.moduleFallback(edge.path)))
          )
            return false;
        }
        observed.push({ name: edge.original, directory, file: edge.path });
        directories.add(path.dirname(edge.path));
      }
    }
    for (const directory of directories)
      this.metadata.use(await this.scope.metadata(directory));
    if (!this.metadata.current()) return false;
    for (const { name, directory, file } of observed) {
      paths.observe(file);
      await paths.dependencyUsage.resolved(name, directory, file);
    }
    return true;
  }
}

function relative(name: string): boolean {
  return /^\.\.?($|[\\/])/.test(name);
}
