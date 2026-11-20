import path from "node:path";

import { ConfigInputs } from "./config-inputs.js";
import type { PathSettings } from "./config-inputs.js";
import { collectFolderCandidates } from "./folder-candidates.js";
import { mappedCandidates } from "./mapped-paths.js";
import { mappedSelection } from "./mapped-selection.js";
import type { ModulePaths } from "./module-paths.js";
import { PackageFolderLocation } from "./package-folder-location.js";
import {
  PackageFolderMaps,
  ordinaryFolderSelection,
  mergeFolderSelections,
} from "./package-folder-maps.js";
import type { FolderSelection } from "./package-folder-maps.js";
import type { PackageJson } from "./package-json.js";
import { nearestPackage, packageDirectories } from "./package-lookup.js";
import { packageMapTargets } from "./package-map.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import type { PnpLocations } from "./pnp-locations.js";
import { packageName } from "./specifier.js";

/** Associate native selections with the shared package-map description. */
export class PackageFolders {
  registry = false;
  private readonly maps: PackageFolderMaps;

  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly paths: ModulePaths,
    private readonly pnp: PnpLocations,
    private readonly configs = new ConfigInputs(inputs, paths, false),
    private readonly observe = true,
    private readonly current = false,
    private readonly cachedScope?: (
      directory: string,
    ) => PathSettings | undefined,
  ) {
    this.maps = new PackageFolderMaps(
      inputs,
      paths,
      observe,
      current,
      (name, directory, selected, forced) =>
        this.lookup(name, directory, selected, forced, false),
    );
  }

  lookup(
    name: string,
    directory: string,
    selected: string | undefined,
    forced = false,
    classify = true,
  ): FolderSelection | undefined {
    const own = nearestPackage(
      this.inputs,
      directory,
      false,
      this.current,
      true,
    );
    if (!this.inputs.complete) throw new Error("package folder input limit");
    if (name.startsWith("#")) {
      if (!own) return undefined;
      return this.maps.describe(
        this.location(
          own.directory,
          selected,
          "self",
          path.join(own.directory, "package.json"),
          own.manifest,
        ),
        "imports",
        name,
        forced,
      );
    }
    let contained = false;
    if (selected !== undefined) {
      const config = directory.split(path.sep).includes("node_modules")
        ? {}
        : (this.cachedScope?.(directory) ?? this.configs.scope(directory));
      if (!this.inputs.complete) throw new Error("package folder input limit");
      for (const base of mappedCandidates(config, name)) {
        const kind = mappedSelection(
          base,
          selected,
          this.paths.settings.resolveExtensions,
        );
        if (kind === "file" || kind === "directory")
          return ordinaryFolderSelection();
        contained ||= kind === "contained";
      }
    }
    let result: FolderSelection | undefined;
    let unplaced: FolderSelection | undefined;
    for (const { directory: pkg, reachable } of this.pnp.roots(
      packageName(name),
      directory,
    )) {
      const location = this.location(pkg, selected, "pnp");
      if (!reachable) {
        this.registry ||= this.folder(location, name);
        continue;
      }
      const found = this.root(location, name, forced);
      if (!this.inputs.complete) throw new Error("package folder input limit");
      if (!found) continue;
      if (found.placed || location.contains()) {
        if (found.candidates?.overflow)
          throw new Error("package folder lookup limit");
        result = mergeFolderSelections(result, found);
      } else unplaced ??= found;
      if (!this.inputs.complete) throw new Error("package folder input limit");
    }
    const identifier = packageName(name);
    const names = own?.manifest.values("name") ?? [];
    const self =
      this.observe && !this.current
        ? names[0] === identifier
        : names.includes(identifier);
    const ownRoot =
      own && self && own.manifest.values("exports").length
        ? own.directory
        : undefined;
    const ordinary =
      classify &&
      this.observe &&
      !this.current &&
      !forced &&
      selected !== undefined &&
      !this.pnp.file;
    let usedNegative = false;
    for (const pkg of this.directories(ownRoot, name, directory)) {
      const file = path.join(pkg, "package.json");
      if (usedNegative && !this.inputs.packageKnown(file, this.current, true))
        return this.lookup(name, directory, selected, forced, false);
      const location = this.location(
        pkg,
        selected,
        pkg === ownRoot ? "self" : "installed",
        file,
        pkg === ownRoot ? own?.manifest : undefined,
      );
      if (usedNegative && location.manifest?.folderExportsPossible)
        return this.lookup(name, directory, selected, forced, false);
      const found = this.root(location, name, forced, ordinary);
      if (!this.inputs.complete) throw new Error("package folder input limit");
      usedNegative ||= location.usedNegative;
      if (found?.placed) return mergeFolderSelections(result, found);
      unplaced ??= found;
    }
    if (result || unplaced) return result ?? unplaced;
    if (contained || !this.configs.readable) return ordinaryFolderSelection();
    if (this.pnp.file) throw new Error("unqualified native PnP package root");
    return undefined;
  }

  private *directories(
    own: string | undefined,
    name: string,
    directory: string,
  ) {
    if (own) yield own;
    yield* packageDirectories(this.paths, name, directory);
  }

  private location(
    directory: string,
    selected: string | undefined,
    provenance: "self" | "installed" | "pnp",
    file = path.join(directory, "package.json"),
    manifest?: PackageJson,
  ): PackageFolderLocation {
    manifest ??= this.inputs.packageJson(file, false, this.current, true);
    if (!this.inputs.complete) throw new Error("package folder input limit");
    return new PackageFolderLocation(
      directory,
      file,
      manifest,
      selected,
      provenance,
      this.inputs,
      this.observe,
    );
  }

  private folder(location: PackageFolderLocation, name: string): boolean {
    const requested = "." + name.slice(packageName(name).length);
    let folder = false;
    for (const value of location.manifest?.values("exports").slice(0, 1) ?? [])
      for (const target of packageMapTargets(
        value,
        requested,
        undefined,
        0,
        true,
      ))
        folder ||= target.selected && target.folder;
    return folder;
  }

  private root(
    location: PackageFolderLocation,
    name: string,
    forced: boolean,
    ordinary = false,
  ): FolderSelection | undefined {
    const subpath = name.slice(packageName(name).length);
    if (location.manifest?.values("exports").length)
      return this.maps.describe(
        location,
        "exports",
        subpath ? "." + subpath : ".",
        forced,
        ordinary,
      );
    if (!forced)
      return location.contains(ordinary)
        ? ordinaryFolderSelection()
        : undefined;
    const candidates = location.describe();
    const placed = collectFolderCandidates(
      candidates,
      path.join(location.directory, subpath),
      location,
      this.inputs,
      this.paths,
      this.observe,
      this.current,
      false,
    );
    location.capture();
    return {
      candidates,
      manifests: [location.file],
      identities: location.identity ? [location.identity] : [],
      placed,
    };
  }
}
