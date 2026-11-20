import { collectFolderCandidates } from "./folder-candidates.js";
import type { FolderCandidates } from "./folder-candidates.js";
import { mappedFiles } from "./mapped-selection.js";
import type { ModulePaths } from "./module-paths.js";
import type { PackageFolderLocation } from "./package-folder-location.js";
import { packageMapTargets, packageTarget } from "./package-map.js";
import type { PhysicalInputs } from "./physical-inputs.js";
import { bareSpecifier } from "./specifier.js";

export interface FolderSelection {
  candidates?: FolderCandidates | undefined;
  manifests: string[];
  identities: string[];
  placed: boolean;
}

export function ordinaryFolderSelection(): FolderSelection {
  return { manifests: [], identities: [], placed: true };
}

export function mergeFolderSelections(
  previous: FolderSelection | undefined,
  next: FolderSelection,
): FolderSelection {
  if (!previous) return next;
  if (next.candidates) {
    if (previous.candidates) previous.candidates.merge(next.candidates);
    else previous.candidates = next.candidates;
  }
  const placed = previous.placed || next.placed;
  if (previous.candidates?.overflow && placed)
    throw new Error("package folder lookup limit");
  return {
    candidates: previous.candidates,
    manifests: [...new Set([...previous.manifests, ...next.manifests])],
    identities: [...new Set([...previous.identities, ...next.identities])],
    placed,
  };
}

/** Describe map targets without selecting native conditions or package owners. */
export class PackageFolderMaps {
  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly paths: ModulePaths,
    private readonly observe: boolean,
    private readonly current: boolean,
    private readonly lookup: (
      name: string,
      directory: string,
      selected: string | undefined,
      forced: boolean,
    ) => FolderSelection | undefined,
  ) {}

  describe(
    location: PackageFolderLocation,
    field: string,
    requested: string,
    forced: boolean,
    literal = false,
  ): FolderSelection | undefined {
    if (
      literal &&
      field === "exports" &&
      !forced &&
      location.selected !== undefined &&
      location.manifest?.folderExportsPossible === false
    ) {
      for (const value of location.manifest.values(field).slice(0, 1))
        for (const { target, selected } of packageMapTargets(
          value,
          requested,
          undefined,
          0,
          true,
        ))
          if (selected) {
            const base = packageTarget(location.directory, target);
            if (
              base === location.selected ||
              mappedFiles(base, this.paths.settings.resolveExtensions).includes(
                location.selected,
              )
            )
              return ordinaryFolderSelection();
          }
    }
    let result: FolderSelection = {
      manifests: [],
      identities: [],
      placed: false,
    };
    let exact = false;
    let knownFolder = forced;
    for (const value of location.manifest?.values(field).slice(0, 1) ?? [])
      for (const { target, folder, selected: active } of packageMapTargets(
        value,
        requested,
        undefined,
        0,
        true,
        field === "imports" || forced,
      )) {
        if (!this.inputs.complete)
          throw new Error("package folder input limit");
        if (!active) continue;
        knownFolder ||= folder;
        if (
          field === "imports" &&
          bareSpecifier(target) &&
          !target.startsWith("#")
        ) {
          const found = this.lookup(
            target,
            location.directory,
            location.selected,
            forced || folder,
          );
          if (found) {
            exact ||= !found.candidates?.present && found.placed;
            result = mergeFolderSelections(result, found);
          }
          continue;
        }
        const base = packageTarget(location.directory, target);
        if (folder || forced) {
          result.placed = collectFolderCandidates(
            (result.candidates ??= location.describe()),
            base,
            location,
            this.inputs,
            this.paths,
            this.observe,
            this.current,
            result.placed,
          );
        } else if (!exact)
          exact = location.matches(base, this.paths.settings.resolveExtensions);
      }
    if (!this.inputs.complete) throw new Error("package folder input limit");
    if (result.candidates?.overflow && (result.placed || exact))
      throw new Error("package folder lookup limit");
    if (!result.candidates?.present)
      return exact
        ? ordinaryFolderSelection()
        : knownFolder
          ? result
          : undefined;
    location.capture();
    result.manifests.push(location.file);
    if (location.identity) result.identities.push(location.identity);
    result.placed ||= exact;
    return result;
  }
}
