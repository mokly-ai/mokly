import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import { shownComparisonEligible, type EntryStatus } from "./view_status.js";

/** One row of a component page's variant bar: the parent's own entry or a variant. */
export interface WorkspaceVariant {
  value: ManifestComponent;
  removed: boolean;
  comparisonEligible: boolean;
  snapshotId?: string;
  status?: EntryStatus;
}

export interface WorkspaceVariantSet {
  current: readonly ManifestComponentVariant[];
  rows: readonly WorkspaceVariant[];
}

/**
 * Adapt sibling variant entries to one routed component workspace of a
 * catalogue without published records. Removed variants join the parent the
 * branch-point lookup resolves for them. `materialChanges` holds the entries
 * that changed beyond a move, so a pure move stays Unmodified and a
 * metadata-only edit reads Changed.
 */
export function workspaceVariants(
  catalogue: Catalogue,
  entry: ManifestComponent,
  known: boolean,
  parentRemoved: boolean,
  parentStatus: EntryStatus | undefined,
  materialChanges?: readonly string[],
): WorkspaceVariantSet {
  const current = (
    catalogue.hierarchy.variantsByPath.get(entry.path) ?? []
  ).filter(
    (candidate): candidate is ManifestComponentVariant =>
      candidate.kind === "component" && isManifestComponentVariant(candidate),
  );
  const removed = branchPoints(catalogue)
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
    const isRemoved =
      parentRemoved || !current.some((item) => item.path === value.path);
    const status = !known
      ? undefined
      : isRemoved
        ? "Removed"
        : materialChanges?.includes(value.path)
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
  return { current, rows };
}

/** Build the only available row when a removed variant has no usable parent. */
export function standaloneWorkspaceVariant(
  entry: ManifestComponentVariant,
  known: boolean,
  removed: boolean,
  entryStatus: EntryStatus | undefined,
  snapshotId?: string,
): WorkspaceVariantSet {
  const status = !known
    ? undefined
    : removed
      ? "Removed"
      : (entryStatus ?? "Unmodified");
  return {
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
