import type { CatalogueChanges, ComparisonSelection } from "@mokly/viewer";
import type { ManifestEntry, ReviewState } from "@mokly/viewer/data";

import type { CatalogueProjectionInput } from "./projection_input.js";

export function entryPreviousPath(
  entry: ManifestEntry,
  input: CatalogueProjectionInput,
): string | undefined {
  if (input.changesStatus !== "ready") return;
  return input.evidence?.pairing?.moves.find(
    (move) => move.kind === entry.kind && move.path === entry.path,
  )?.previousPath;
}

export function entryChanges(
  entry: ManifestEntry,
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
  const before = input.evidence?.baseline.entries.find(
    (candidate) =>
      candidate.kind === entry.kind &&
      candidate.path.toLowerCase() ===
        (previousPath ?? entry.path).toLowerCase(),
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
