/** Lookup inputs from the projection's accepted catalogue and evidence. */

import { branchPoints, type BranchPointLookup } from "@mokly/viewer/data";

import type { CatalogueProjectionInput } from "./projection_input.js";

const inputs = new WeakMap<
  CatalogueProjectionInput,
  ReturnType<typeof acceptedInputs>
>();
type ProjectionRecord =
  CatalogueProjectionInput["catalogue"]["removedEntries"][number];

function acceptedInputs(input: CatalogueProjectionInput) {
  return {
    manifest: input.catalogue.manifest,
    removedEntries:
      input.changesStatus === "ready" ? input.catalogue.removedEntries : [],
    moves:
      input.changesStatus === "ready"
        ? (input.evidence?.pairing?.moves ?? [])
        : [],
  };
}

/** Resolve only the move evidence accepted for this projection. */
export function projectionBranchPoints(
  input: CatalogueProjectionInput,
): BranchPointLookup<ProjectionRecord["entry"], ProjectionRecord> {
  if (input.changesStatus === "ready" && !input.evidence?.pairing)
    return branchPoints(input.catalogue);
  let accepted = inputs.get(input);
  if (!accepted) {
    accepted = acceptedInputs(input);
    inputs.set(input, accepted);
  }
  return branchPoints(accepted);
}
