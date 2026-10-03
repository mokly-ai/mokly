import type {
  ManifestComponent,
  ManifestComponentVariant,
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
  snapshotId?: string;
  status?: EntryStatus;
}

export interface WorkspaceVariantSet {
  baseline: readonly ManifestComponentVariant[];
  current: readonly ManifestComponentVariant[];
  rows: readonly WorkspaceVariant[];
}

/** Adapt sibling variant entries to one routed component workspace. */
export function workspaceVariants(
  catalogue: Catalogue,
  entry: ManifestComponent,
  snapshot: ShellContext["componentChanges"],
  comparison: ComponentReview | undefined,
  known: boolean,
  parentRemoved: boolean,
  parentStatus: EntryStatus | undefined,
  changedEntries?: readonly string[],
): WorkspaceVariantSet {
  const current = (
    catalogue.hierarchy.variantsByPath.get(entry.path) ?? []
  ).filter(
    (candidate): candidate is ManifestComponentVariant =>
      candidate.kind === "component" && isManifestComponentVariant(candidate),
  );
  const baseline: ManifestComponentVariant[] = [
    ...(snapshot?.baseline.entries.filter(
      (candidate): candidate is ManifestComponentVariant =>
        candidate.kind === "component" &&
        isManifestComponentVariant(candidate) &&
        candidate.variantOf === entry.path,
    ) ?? []),
  ];
  const removed = catalogue.removedEntries.flatMap(
    ({ entry: candidate, snapshotId }) =>
      candidate.kind === "component" &&
      isManifestComponentVariant(candidate) &&
      candidate.variantOf === entry.path
        ? [{ value: candidate, snapshotId }]
        : [],
  );
  const values = [
    ...current.map((value) => ({ value, snapshotId: undefined })),
    ...removed,
  ];
  const rows = values.map(({ value, snapshotId }): WorkspaceVariant => {
    const review = comparison?.variants.find(
      (item) => item.path === value.path,
    );
    const isRemoved =
      parentRemoved || !current.some((item) => item.path === value.path);
    const status = !known
      ? undefined
      : isRemoved
        ? "Removed"
        : review?.state === "added"
          ? "Added"
          : review?.state === "changed" ||
              changedEntries?.includes(value.path) ||
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
      ...(snapshotId ? { snapshotId } : {}),
      ...(status ? { status } : {}),
    };
  });
  return { baseline, current, rows };
}

/** Build the only available row when a removed variant has no usable parent. */
export function standaloneWorkspaceVariant(
  entry: ManifestComponentVariant,
  snapshot: ShellContext["componentChanges"],
  comparison: ComponentReview | undefined,
  known: boolean,
  removed: boolean,
  entryStatus: EntryStatus | undefined,
  snapshotId?: string,
): WorkspaceVariantSet {
  const baseline = snapshot?.baseline.entries.flatMap((candidate) =>
    candidate.kind === "component" &&
    isManifestComponentVariant(candidate) &&
    candidate.path === entry.path
      ? [candidate]
      : [],
  ) ?? [entry];
  const review = comparison?.variants.find(
    (candidate) => candidate.path === entry.path,
  );
  const status = !known
    ? undefined
    : removed
      ? "Removed"
      : review?.state === "added"
        ? "Added"
        : review?.state === "changed"
          ? "Changed"
          : (entryStatus ?? "Unmodified");
  return {
    baseline,
    current: removed ? [] : [entry],
    rows: [
      {
        value: entry,
        removed,
        comparisonEligible: shownComparisonEligible(status, "component"),
        ...(snapshotId ? { snapshotId } : {}),
        ...(status ? { status } : {}),
      },
    ],
  };
}
