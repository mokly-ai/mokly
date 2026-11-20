import path from "node:path";

import type { Metafile } from "esbuild";

import type { PlannedImport } from "../generated/sidecar/PlannedImport.js";

import type { ModulePaths } from "./module-paths.js";
import { classifyNativeTarget } from "./native-plan.js";
import { planKey } from "./native-resolution.js";
import { PackageScope } from "./package-scope.js";
import { specifierFilter } from "./specifier-filter.js";

/** The planned relative strings that can use esbuild's own resolution. */
export class PlannedRelative {
  private constructor(
    readonly filter: RegExp,
    private readonly skipped: ReadonlySet<string>,
    private readonly plan: ReadonlyMap<string, PlannedImport>,
    private readonly scope: PackageScope,
  ) {}

  static async create(
    plan: ReadonlyMap<string, PlannedImport>,
  ): Promise<PlannedRelative | undefined> {
    const candidates = new Map<string, PlannedImport[]>();
    for (const [key, target] of plan) {
      let parts: unknown;
      try {
        parts = JSON.parse(key);
      } catch {
        continue;
      }
      const name: unknown = Array.isArray(parts) ? parts[1] : undefined;
      if (typeof name !== "string" || !relative(name)) continue;
      const files = candidates.get(name) ?? [];
      files.push(target);
      candidates.set(name, files);
    }
    const scope = new PackageScope();
    const settings = new Map<string, Promise<boolean | undefined>>();
    const safe = new Set<string>();
    for (const [name, files] of candidates) {
      let distinct = false;
      for (const target of files) {
        let parsed = settings.get(target.path);
        if (!parsed) {
          parsed = scope
            .parseSettings(target.path)
            .then((distinct) =>
              distinct ? undefined : scope.sideEffects(target.path),
            );
          settings.set(target.path, parsed);
        }
        if ((await parsed) !== target.sideEffects) {
          distinct = true;
          break;
        }
      }
      if (!distinct) safe.add(name);
    }
    const { filter, skipped } = specifierFilter(safe);
    return skipped.size
      ? new PlannedRelative(filter, skipped, plan, scope)
      : undefined;
  }

  /** Prove skipped edges before recording their full-path observations. */
  async verify(metafile: Metafile, paths: ModulePaths): Promise<boolean> {
    const observed: Array<{ name: string; directory: string; file: string }> =
      [];
    const targets = new Map<string, ReturnType<typeof classifyNativeTarget>>();
    for (const [importer, input] of Object.entries(metafile.inputs)) {
      if (!path.isAbsolute(importer)) continue;
      const directory = path.dirname(importer);
      for (const edge of input.imports) {
        if (edge.external && this.skipped.has(edge.path)) return false;
        if (edge.external || !path.isAbsolute(edge.path)) continue;
        if (edge.original === undefined) return false;
        if (!this.skipped.has(edge.original)) continue;
        const planned = this.plan.get(
          planKey(importer, edge.original, edge.kind),
        );
        if (planned) {
          if (planned.path !== edge.path) return false;
        } else {
          let target = targets.get(edge.path);
          if (!target) {
            target = classifyNativeTarget(paths, this.scope, edge.path);
            targets.set(edge.path, target);
          }
          const resolved = await target;
          if (
            !resolved ||
            resolved.distinct ||
            (paths.settings.mainFields.length === 0 &&
              edge.kind !== "require-call" &&
              (await this.scope.moduleFallback(edge.path)))
          )
            return false;
        }
        observed.push({ name: edge.original, directory, file: edge.path });
      }
    }
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
