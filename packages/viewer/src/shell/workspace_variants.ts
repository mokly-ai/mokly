import type {
  ManifestComponent,
  ManifestComponentVariant,
  HistoricalManifestComponentVariant,
} from "../components/manifest_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import type { ComponentReview } from "../review/component_types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { shownComparisonEligible, type EntryStatus } from "./view_status.js";

export interface WorkspaceVariant {
  value: ManifestComponentVariant;
  removed: boolean;
  comparisonEligible: boolean;
  status?: EntryStatus;
}

export interface WorkspaceVariantSet {
  baseline: readonly ManifestComponentVariant[];
  current: readonly ManifestComponentVariant[];
  rows: readonly WorkspaceVariant[];
}

/** Adapt current and removed variant entries to the query-based legacy workspace. */
export function workspaceVariants(
  catalogue: Catalogue,
  entry: ManifestComponent,
  snapshot: ShellContext["componentChanges"],
  comparison: ComponentReview | undefined,
  known: boolean,
  parentRemoved: boolean,
  parentStatus: EntryStatus | undefined,
): WorkspaceVariantSet {
  const current = (catalogue.hierarchy.variantsById.get(entry.id) ?? []).filter(
    (candidate): candidate is ManifestComponentVariant =>
      candidate.kind === "component" && isManifestComponentVariant(candidate),
  );
  const baseline: ManifestComponentVariant[] = [
    ...(snapshot?.baseline.entries.filter(
      (candidate): candidate is HistoricalManifestComponentVariant =>
        candidate.kind === "component" &&
        isManifestComponentVariant(candidate) &&
        candidate.variantOf === entry.id,
    ) ?? []),
  ];
  const removed = catalogue.removedEntries.flatMap(({ entry: candidate }) =>
    candidate.kind === "component" &&
    isManifestComponentVariant(candidate) &&
    candidate.variantOf === entry.id
      ? [candidate]
      : [],
  );
  const rows = [...current, ...removed].map((value): WorkspaceVariant => {
    const review = comparison?.variants.find((item) => item.id === value.id);
    const isRemoved =
      parentRemoved || !current.some((item) => item.id === value.id);
    const status = !known
      ? undefined
      : isRemoved
        ? "Removed"
        : review?.state === "added"
          ? "Added"
          : review?.state === "changed" ||
              (review?.before &&
                review.after &&
                JSON.stringify(review.before.props) !==
                  JSON.stringify(review.after.props))
            ? "Changed"
            : parentStatus === "Added"
              ? "Added"
              : "Unmodified";
    return {
      value,
      removed: isRemoved,
      comparisonEligible: shownComparisonEligible(status, "component"),
      ...(status ? { status } : {}),
    };
  });
  return { baseline, current, rows };
}
