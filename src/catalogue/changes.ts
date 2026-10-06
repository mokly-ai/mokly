import type { CatalogueChanges, ComparisonSelection } from "@mokly/viewer";
import { baselineInventory } from "@mokly/viewer/data";
import type {
  BranchPointPath,
  CurrentPath,
  ManifestEntry,
  ReviewState,
} from "@mokly/viewer/data";

import { projectionBranchPoints } from "./branch_points.js";
import type { CatalogueProjectionInput } from "./projection_input.js";

export function entryPreviousPath(
  entry: ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>,
  input: CatalogueProjectionInput,
): BranchPointPath | undefined {
  if (input.changesStatus !== "ready") return;
  return projectionBranchPoints(input).previousPath(entry);
}

export function entryChanges(
  entry: ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>,
  input: CatalogueProjectionInput,
  removed: boolean,
): CatalogueChanges {
  if (input.changesStatus !== "ready") return { status: input.changesStatus };
  const previousPath = entryPreviousPath(entry, input);
  const changed = (
    input.evidence?.changedEntries ??
    input.changedEntries ??
    []
  ).includes(entry.path);
  const included =
    removed ||
    previousPath !== undefined ||
    (input.changedEntries ?? input.evidence?.changedEntries ?? []).includes(
      entry.path,
    );
  const before =
    input.evidence &&
    projectionBranchPoints(input).baselineEntry(
      entry,
      baselineInventory(input.evidence.baseline).entries,
    );
  return {
    status: "ready",
    included,
    kind: removed
      ? "removed"
      : input.evidence && !before
        ? "added"
        : changed
          ? "changed"
          : "unmodified",
  };
}

export function comparisonSelection(
  input: CatalogueProjectionInput,
  state: ReviewState | undefined,
  component: boolean,
): ComparisonSelection {
  if (input.changesStatus !== "ready")
    return {
      status:
        input.changesStatus === "preparing" ? "pending" : input.changesStatus,
    };
  if (!state) return { status: "unavailable" };
  const kind =
    state === "ignored-only" || state === "unchanged" ? "unmodified" : state;
  return {
    status: "ready",
    kind,
    eligible: kind === "changed" || (component && kind === "removed"),
  };
}
