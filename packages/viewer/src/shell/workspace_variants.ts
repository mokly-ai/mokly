import { branchPoints } from "../catalogue/branch_point.js";
import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
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
  value: ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>;
  removed: boolean;
  comparisonEligible: boolean;
  snapshotId?: string;
  status?: EntryStatus;
}

export interface WorkspaceVariantSet {
  baseline: readonly ManifestComponentVariant<BranchPointPath>[];
  current: readonly ManifestComponentVariant<CurrentPath>[];
  rows: readonly WorkspaceVariant[];
}

/**
 * Adapt sibling variant entries to one routed component workspace. Each
 * current variant pairs with its own baseline counterpart, even when it moved
 * between parents, and removed variants join the parent the branch-point
 * lookup resolves for them. `materialChanges` holds the entries that changed
 * beyond a move, so a pure move stays Unmodified and a metadata-only edit
 * reads Changed.
 */
export function workspaceVariants(
  catalogue: Catalogue,
  entry: ManifestComponent<CurrentPath>,
  snapshot: ShellContext["componentChanges"],
  comparison: ComponentReview<CurrentPath, BranchPointPath> | undefined,
  known: boolean,
  parentRemoved: boolean,
  parentStatus: EntryStatus | undefined,
  materialChanges?: readonly string[],
): WorkspaceVariantSet {
  const lookup = branchPoints(catalogue);
  const current = (
    catalogue.hierarchy.variantsByPath.get(entry.path) ?? []
  ).filter(
    (candidate): candidate is ManifestComponentVariant<CurrentPath> =>
      candidate.kind === "component" && isManifestComponentVariant(candidate),
  );
  const baseline = current.flatMap((variant) => {
    const counterpart =
      snapshot && lookup.baselineEntry(variant, snapshot.baseline.entries);
    return counterpart?.kind === "component" &&
      isManifestComponentVariant(counterpart)
      ? [counterpart]
      : [];
  });
  const removed = lookup
    .removedVariants(entry)
    .flatMap(({ entry: candidate, snapshotId }) =>
      candidate.kind === "component" && isManifestComponentVariant(candidate)
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
              materialChanges?.includes(value.path) ||
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
  catalogue: Catalogue,
  entry: ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>,
  snapshot: ShellContext["componentChanges"],
  comparison: ComponentReview<CurrentPath, BranchPointPath> | undefined,
  known: boolean,
  removed: boolean,
  entryStatus: EntryStatus | undefined,
  snapshotId?: string,
): WorkspaceVariantSet {
  const counterpart =
    snapshot &&
    branchPoints(catalogue).baselineEntry(entry, snapshot.baseline.entries);
  const baseline =
    counterpart?.kind === "component" && isManifestComponentVariant(counterpart)
      ? [counterpart]
      : [];
  const current = catalogue.manifest.entries.filter(
    (candidate): candidate is ManifestComponentVariant<CurrentPath> =>
      candidate.path === entry.path &&
      candidate.kind === "component" &&
      isManifestComponentVariant(candidate),
  );
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
    current: removed ? [] : current,
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
