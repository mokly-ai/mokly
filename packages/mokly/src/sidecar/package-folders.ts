import path from "node:path";

import { ConfigInputs } from "./config-inputs.js";
import { mappedCandidates } from "./mapped-paths.js";
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
import type { PnpLocations } from "./pnp-locations.js";
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
    private readonly pnp: PnpLocations,
    private readonly configs = new ConfigInputs(inputs, paths, false),
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
    let contained = false;
    if (selected !== undefined)
      for (const base of mappedCandidates(
        this.configs.scope(directory),
        name,
      )) {
        const kind = mappedSelection(
          base,
          selected,
          this.paths.settings.resolveExtensions,
        );
        if (kind === "file" || kind === "directory")
          return { candidates: [], manifests: [], placed: true };
        contained ||= kind === "contained";
      }
    let result: FolderSelection | undefined;
    for (const pkg of this.pnp.roots(packageName(name))) {
      const found = this.root(pkg, name, selected, forced);
      if (found) result = this.merge(result, found);
    }
    if (
      own?.manifest.values("name").includes(packageName(name)) &&
      own.manifest.values("exports").length
    ) {
      const found = this.root(own.directory, name, selected, forced);
      if (found) return this.merge(result, found);
    }
    for (const pkg of packageDirectories(this.paths, name, directory)) {
      const found = this.root(pkg, name, selected, forced);
      if (found) return this.merge(result, found);
    }
    if (!result && (contained || !this.configs.readable))
      return { candidates: [], manifests: [], placed: true };
    if (!result && this.pnp.file)
      throw new Error("unqualified native PnP package root");
    return result;
  }

  private root(
    directory: string,
    name: string,
    selected: string | undefined,
    forced: boolean,
  ): FolderSelection | undefined {
    const pkg = this.inputs.canonicalDirectory(directory, this.observe);
    if (!pkg || (selected !== undefined && !inside(pkg, selected)))
      return undefined;
    const file = path.join(pkg, "package.json");
    const manifest = this.inputs.packageJson(
      file,
      this.observe,
      this.current,
      true,
    );
    const subpath = name.slice(packageName(name).length);
    if (manifest?.values("exports").length)
      return this.map(
        pkg,
        manifest,
        "exports",
        subpath ? "." + subpath : ".",
        selected,
        forced,
      );
    if (!forced) return { candidates: [], manifests: [], placed: true };
    const candidates = [
      ...packageFolderCandidates(
        path.join(pkg, subpath),
        this.inputs,
        this.paths.settings.mainFields,
        this.observe,
        this.current,
        true,
      ),
    ];
    return {
      candidates,
      manifests: [file],
      placed: candidates.some((base) => this.matches(base, selected)),
    };
  }

  private merge(
    previous: FolderSelection | undefined,
    next: FolderSelection,
  ): FolderSelection {
    return {
      candidates: [
        ...new Set([...(previous?.candidates ?? []), ...next.candidates]),
      ],
      manifests: [
        ...new Set([...(previous?.manifests ?? []), ...next.manifests]),
      ],
      placed: (previous?.placed ?? false) || next.placed,
    };
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
    let result: FolderSelection = {
      candidates: [],
      manifests: [canonical],
      placed: false,
    };
    let ordinary = false;
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
          if (found) {
            result = this.merge(result, found);
            ordinary ||= !found.candidates.length && found.placed;
          }
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
          result.candidates.push(...expanded);
          result.placed ||= expanded.some((base) =>
            this.matches(base, selected),
          );
        } else if (!ordinary) ordinary = this.matches(base, selected);
      }
    }
    if (
      result.candidates.length &&
      (result.placed ||
        ordinary ||
        selected === undefined ||
        inside(pkg, selected))
    )
      return { ...result, placed: result.placed || ordinary };
    return ordinary
      ? { candidates: [], manifests: [], placed: true }
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
