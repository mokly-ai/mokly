/** Build accepted live selection inputs without filesystem or Git work. */
import type { RemovedEntryPreview } from "@mokly/viewer";
import type { ReviewResult } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import type { CatalogueProjectionInput } from "../catalogue/projection_input.js";
import type { CatalogueMetadata } from "../registry/catalogue_index.js";
import { removedManifestEntries } from "../registry/changes.js";
import type {
  RemovedPagePreviewSource,
  SelectedReviewSource,
} from "../review/selection_types.js";

import type { ComponentChangeSnapshot } from "./component_changes.js";
import type { PublicComparison } from "./public_review.js";
import type { ChangesStatus } from "./update_messages.js";

export function selectedReviewSource(
  manifest: CatalogueMetadata,
  changes: ComponentChangeSnapshot | undefined,
): SelectedReviewSource | undefined {
  if (manifest.schemaVersion !== 7 || !changes?.comparison) return;
  return {
    ...changes.comparison,
    before: changes.baseline,
    after: manifest,
    ...(changes.result ? { result: changes.result } : {}),
  };
}

export function removedPagePreviewSource(
  catalogue: Catalogue,
  changes: ComponentChangeSnapshot | undefined,
  status: ChangesStatus,
): RemovedPagePreviewSource | undefined {
  if (status !== "ready" || !changes?.comparison) return;
  const removedEntries = removedManifestEntries(
    catalogue.manifest,
    changes.baseline,
  );
  return {
    schemaVersion: 1,
    baseline: changes.baseline,
    baseCommit: changes.comparison.baseCommit,
    baseRef: changes.comparison.baseRef,
    changedIds: [
      ...new Set([
        ...(changes.changedIds ?? []),
        ...removedEntries.map(({ entry }) => entry.id),
      ]),
    ].sort(),
    removedEntries,
  };
}

type LivePublicInput = Omit<
  CatalogueProjectionInput,
  "configPath" | "revision" | "usage"
>;

/** Project one accepted live state without retaining descriptors from old evidence. */
export function livePublicInput(
  catalogue: Catalogue,
  changesStatus: CatalogueProjectionInput["changesStatus"],
  changedIds: readonly string[] | undefined,
  evidence: ComponentChangeSnapshot | undefined,
  comparison: PublicComparison | undefined,
): LivePublicInput {
  return {
    catalogue,
    changesStatus,
    changedIds,
    evidence,
    comparison: comparison?.result,
    comparisonUrl: comparison?.path ?? null,
    removedPreviews: servedScreenPreviews(catalogue, comparison?.result),
  };
}

export function servedScreenPreviews(
  catalogue: Catalogue,
  result: ReviewResult | undefined,
): ReadonlyMap<string, RemovedEntryPreview> | undefined {
  if (!result) return;
  const complete = new Set(
    result.screens.flatMap((screen) =>
      screen.state === "removed" &&
      screen.before !== undefined &&
      screen.after === undefined &&
      screen.views.length > 0 &&
      screen.views.every((view) => view.state === "removed")
        ? [screen.id]
        : [],
    ),
  );
  return new Map(
    catalogue.removedEntries.flatMap(({ entry }) =>
      entry.kind === "screen" && complete.has(entry.id)
        ? [[entry.id, { kind: "screen" as const }]]
        : [],
    ),
  );
}
