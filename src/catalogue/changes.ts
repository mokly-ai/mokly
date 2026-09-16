import type { CatalogueChanges, ComparisonSelection } from "@mokly/viewer";
import type { ManifestEntry, ReviewState } from "@mokly/viewer/data";

import type { CatalogueProjectionInput } from "./projection_input.js";

export function entryChanges(
  entry: ManifestEntry,
  input: CatalogueProjectionInput,
  removed: boolean,
): CatalogueChanges {
  if (input.changesStatus !== "ready") return { status: input.changesStatus };
  const included =
    removed ||
    (entry.kind === "collection"
      ? (input.catalogue.hierarchy.childrenById.get(entry.id) ?? []).some(
          (child) => {
            const changes = entryChanges(child, input, false);
            return changes.status === "ready" && changes.included;
          },
        )
      : (input.changedRoutes ?? input.evidence?.changedRoutes ?? []).includes(
          entry.route,
        ));
  const before = input.evidence?.baseline.entries.find((candidate) =>
    entry.kind === "collection" || entry.kind === "component"
      ? candidate.id === entry.id
      : candidate.kind !== "collection" && candidate.route === entry.route,
  );
  return {
    status: "ready",
    included,
    kind: removed
      ? "removed"
      : input.evidence && !before
        ? "added"
        : included
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
