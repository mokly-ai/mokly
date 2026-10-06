/** Lookup inputs from the projection's accepted catalogue and evidence. */

import {
  acceptedCatalogue,
  branchPoints,
  readCurrentPath,
  readBranchPointPath,
  type BranchPointLookup,
  type CurrentPath,
  type ManifestEntry,
} from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import type { CatalogueProjectionInput } from "./projection_input.js";

const inputs = new WeakMap<
  CatalogueProjectionInput,
  ReturnType<typeof acceptedInputs>
>();

function acceptedInputs(input: CatalogueProjectionInput) {
  const catalogue = acceptedCatalogue(input.catalogue);
  return {
    manifest: catalogue.manifest,
    removedEntries:
      input.changesStatus === "ready" ? catalogue.removedEntries : [],
    moves:
      input.changesStatus === "ready"
        ? (input.evidence?.pairing?.moves ?? []).map((pair) => ({
            ...pair,
            path: readCurrentPath(pair.path),
            previousPath: readBranchPointPath(pair.previousPath),
          }))
        : [],
  };
}

/** Resolve only the move evidence accepted for this projection. */
export function projectionBranchPoints(
  input: CatalogueProjectionInput,
): BranchPointLookup<
  ManifestEntry<CurrentPath>,
  Catalogue<CurrentPath>["removedEntries"][number]
> {
  if (input.changesStatus === "ready" && !input.evidence?.pairing)
    return branchPoints(acceptedCatalogue(input.catalogue));
  let accepted = inputs.get(input);
  if (!accepted) {
    accepted = acceptedInputs(input);
    inputs.set(input, accepted);
  }
  return branchPoints(accepted);
}
