import path from "node:path";

import { mappedSelection } from "./mapped-selection.js";
import type { ModulePaths } from "./module-paths.js";
import type { PackageJson } from "./package-json.js";
import { nearestPackage, packageDirectories } from "./package-lookup.js";
import {
  packageFolderCandidates,
  packageMapTargets,
  packageTarget,
} from "./package-map.js";
import { inside } from "./path-scope.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import { bareSpecifier, packageName } from "./specifier.js";

export interface FolderSelection {
  candidates: string[];
  manifests: string[];
  placed: boolean;
}

/** Associate the native selection with one shared description of package-map probes. */
export class PackageFolders {
  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly paths: ModulePaths,
    private readonly observe = true,
    private readonly current = false,
  ) {}

  lookup(
    name: string,
    directory: string,
    selected: string | undefined,
    forced = false,
  ): FolderSelection | undefined {
    const own = nearestPackage(
      this.inputs,
      directory,
      this.observe,
      this.current,
      true,
    );
    if (name.startsWith("#")) {
      if (!own) return undefined;
      return this.map(
        own.directory,
        own.manifest,
        "imports",
        name,
        selected,
        forced,
      );
    }
    const subpath = name.slice(packageName(name).length);
    const requested = subpath ? "." + subpath : ".";
    if (own?.manifest.values("name").includes(packageName(name))) {
      const found = this.map(
        own.directory,
        own.manifest,
        "exports",
        requested,
        selected,
        forced,
      );
      if (found) return found;
    }
    for (
      let current = selected && path.dirname(selected);
      current;
      current = path.dirname(current)
    ) {
      const manifest = this.inputs.packageJson(
        path.join(current, "package.json"),
        this.observe,
        this.current,
        true,
      );
      if (manifest) {
        const found = this.map(
          current,
          manifest,
          "exports",
          requested,
          selected,
          forced,
        );
        if (found) return found;
        if (forced && !manifest.values("exports").length) {
          const candidates = [
            ...packageFolderCandidates(
              path.join(current, subpath),
              this.inputs,
              this.paths.settings.mainFields,
              this.observe,
              this.current,
              true,
            ),
          ];
          if (candidates.some((base) => this.matches(base, selected)))
            return {
              candidates,
              manifests: [path.join(current, "package.json")],
              placed: true,
            };
        }
      }
      if (current === path.dirname(current)) break;
    }
    for (const pkg of packageDirectories(this.paths, name, directory)) {
      const manifest = this.inputs.packageJson(
        path.join(pkg, "package.json"),
        this.observe,
        this.current,
        true,
      );
      if (manifest) {
        const found = this.map(
          pkg,
          manifest,
          "exports",
          requested,
          selected,
          forced,
        );
        if (found) return found;
      }
      if (forced && !manifest?.values("exports").length) {
        const base = path.join(pkg, subpath);
        const candidates = [
          ...packageFolderCandidates(
            base,
            this.inputs,
            this.paths.settings.mainFields,
            this.observe,
            this.current,
            true,
          ),
        ];
        if (candidates.some((base) => this.matches(base, selected)))
          return {
            candidates,
            manifests: [path.join(pkg, "package.json")],
            placed: true,
          };
      }
    }
    return undefined;
  }

  private map(
    pkg: string,
    manifest: PackageJson,
    field: string,
    requested: string,
    selected: string | undefined,
    forced: boolean,
  ): FolderSelection | undefined {
    const file = path.join(pkg, "package.json");
    const canonical = this.observe ? this.inputs.canonicalFile(file) : file;
    if (!canonical) return undefined;
    pkg = path.dirname(canonical);
    const candidates: string[] = [];
    let matches = false;
    for (const value of manifest.values(field).slice(0, 1)) {
      for (const { target, folder, selected: active } of packageMapTargets(
        value,
        requested,
        undefined,
        0,
        true,
      )) {
        if (!active) continue;
        if (
          field === "imports" &&
          bareSpecifier(target) &&
          !target.startsWith("#")
        ) {
          const found = this.lookup(target, pkg, selected, forced || folder);
          if (found)
            return { ...found, manifests: [...found.manifests, canonical] };
          continue;
        }
        const base = packageTarget(pkg, target);
        if (folder || forced) {
          const expanded = [
            ...packageFolderCandidates(
              base,
              this.inputs,
              this.paths.settings.mainFields,
              this.observe,
              this.current,
              true,
            ),
          ];
          candidates.push(...expanded);
          matches ||= expanded.some((base) => this.matches(base, selected));
        } else if (this.matches(base, selected))
          return { candidates: [], manifests: [], placed: true };
      }
    }
    return matches ||
      (candidates.length && (selected === undefined || inside(pkg, selected)))
      ? { candidates, manifests: [canonical], placed: matches }
      : undefined;
  }

  private matches(base: string, selected: string | undefined): boolean {
    return (
      selected !== undefined &&
      mappedSelection(base, selected, this.paths.settings.resolveExtensions) !==
        undefined
    );
  }
}
