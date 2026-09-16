/** Workspace values derived only from the validated public catalogue. */
import type {
  CatalogueReadModel,
  CatalogueRoutedEntry,
} from "../catalogue/types.js";
import { generatedViews } from "../components/views.js";
import type {
  EntryStatus,
  UsageLink,
  WorkspaceData,
} from "../shell/workspace_data.js";

import { displayEntry } from "./projection.js";
import { routedEntries } from "./selection.js";

const statuses = {
  added: "Added",
  changed: "Changed",
  removed: "Removed",
  unmodified: "Unmodified",
} as const;
function status(entry: CatalogueRoutedEntry): EntryStatus | undefined {
  return entry.changes.status === "ready"
    ? statuses[entry.changes.kind]
    : undefined;
}
export function publicWorkspace(
  model: CatalogueReadModel,
  entry: WorkspaceData["entry"],
): WorkspaceData {
  const original = routedEntries(model).find(
    (candidate) => candidate.id === entry.id,
  );
  if (
    !original ||
    (original.kind !== "screen" && original.kind !== "component")
  )
    throw new Error("The selected item is unavailable.");
  const removed = model.removedEntries.some((item) => item.entry === original);
  const usedBy: UsageLink[] = [];
  for (const owner of routedEntries(model)) {
    if (owner.kind !== "screen" && owner.kind !== "component") continue;
    for (const view of generatedViews(displayEntry(owner)))
      for (const instance of view.usage?.instances ?? [])
        if (instance.componentId === entry.id)
          usedBy.push({
            title: owner.title,
            route: owner.route,
            ...(view.variantId ? { variantId: view.variantId } : {}),
            viewport: view.viewport,
            colorScheme: view.colorScheme,
            instanceKey: instance.key,
            direct: instance.owner.kind === "entry",
            removed: model.removedEntries.some(
              (value) => value.entry === owner,
            ),
            comparisonEligible: false,
          });
  }
  const entryStatus = status(original);
  const variants =
    entry.kind === "component" && original.kind === "component"
      ? entry.variants.map((value) => {
          const source = original.variants.find(
            (item) => item.id === value.id,
          )!;
          return {
            value,
            removed:
              removed ||
              (source.comparison.status === "ready" &&
                source.comparison.kind === "removed"),
            comparisonEligible:
              source.comparison.status === "ready" &&
              source.comparison.eligible,
            ...(source.comparison.status === "ready"
              ? { status: statuses[source.comparison.kind] }
              : {}),
          };
        })
      : [];
  return {
    entry,
    components: [
      ...model.components,
      ...model.removedEntries.flatMap(({ entry }) =>
        entry.kind === "component" ? [entry] : [],
      ),
    ].map(({ id, title, route }) => ({ id, title, route })),
    views: generatedViews(entry),
    variants,
    usedBy,
    affected: [],
    base: "",
    comparisons: model.comparisonUrl !== null,
    comparisonEligible:
      original.kind === "screen"
        ? original.views.some(
            (view) =>
              view.comparison.status === "ready" && view.comparison.eligible,
          )
        : variants.some((variant) => variant.comparisonEligible),
    removed,
    relatedComponents: [],
    inputChanges: [],
    ...(entryStatus ? { status: entryStatus } : {}),
  };
}
