/** Workspace values derived only from the validated public catalogue. */
import { resolveCatalogueRecord } from "../catalogue/entry_selection.js";
import type {
  CatalogueComponent,
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueScreen,
  CatalogueView,
} from "../catalogue/types.js";
import { generatedViews } from "../components/views.js";
import type { ReviewState } from "../review/types.js";
import { orderChangedViews, type ChangedView } from "../shell/view_marks.js";
import type { ViewState, ViewStatesBySelection } from "../shell/view_status.js";
import type {
  EntryStatus,
  UsageLink,
  WorkspaceData,
} from "../shell/workspace_data.js";
import type { ChangedViewsBySelection } from "../shell/workspace_views_data.js";

import { displayEntry } from "./projection.js";
import { routedEntries } from "./selection.js";

const statuses = {
  added: "Added",
  changed: "Changed",
  removed: "Removed",
  unmodified: "Unmodified",
} as const;
const reviewStates: Readonly<Record<keyof typeof statuses, ReviewState>> = {
  added: "added",
  changed: "changed",
  removed: "removed",
  unmodified: "unchanged",
};
function status(entry: CatalogueRoutedEntry): EntryStatus | undefined {
  return entry.changes.status === "ready"
    ? statuses[entry.changes.kind]
    : undefined;
}
/** Published per-view comparisons name the same changed views the shell derives. */
function publishedChangedViews(
  views: readonly CatalogueView[],
): readonly ChangedView[] {
  return orderChangedViews(
    views.flatMap((view) =>
      view.comparison.status === "ready" &&
      view.comparison.kind !== "unmodified"
        ? [{ colorScheme: view.colorScheme, viewport: view.viewport }]
        : [],
    ),
  );
}

/** Key public comparison evidence exactly like the served workspace data. */
function publishedChangedViewsBySelection(
  entry: CatalogueComponent | CatalogueScreen,
): ChangedViewsBySelection {
  if (entry.kind === "screen")
    return { [entry.id]: publishedChangedViews(entry.views) };
  return Object.fromEntries(
    entry.variants.map((variant) => [
      variant.id,
      publishedChangedViews(variant.views),
    ]),
  );
}

/** Keep only published views whose comparison state is ready. */
function publishedViewStates(
  views: readonly CatalogueView[],
): readonly ViewState[] | undefined {
  const states = views.flatMap((view) =>
    view.comparison.status === "ready"
      ? [
          {
            colorScheme: view.colorScheme,
            state: reviewStates[view.comparison.kind],
            viewport: view.viewport,
          },
        ]
      : [],
  );
  return states.length > 0 ? states : undefined;
}

/** Key published ready states like the served workspace evidence. */
function publishedViewStatesBySelection(
  entry: CatalogueComponent | CatalogueScreen,
): ViewStatesBySelection {
  if (entry.kind === "screen") {
    const states = publishedViewStates(entry.views);
    return states === undefined ? {} : { [entry.id]: states };
  }
  const evidence: Record<string, readonly ViewState[]> = {};
  for (const variant of entry.variants) {
    const states = publishedViewStates(variant.views);
    if (states !== undefined) evidence[variant.id] = states;
  }
  return evidence;
}

export function publicWorkspace(
  model: CatalogueReadModel,
  entry: WorkspaceData["entry"],
  comparisons = model.comparisonUrl !== null,
): WorkspaceData {
  const original = resolveCatalogueRecord(model, entry)?.entry;
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
    changedViews: publishedChangedViewsBySelection(original),
    viewStates: publishedViewStatesBySelection(original),
    variants,
    usedBy,
    affected: [],
    base: "",
    comparisons,
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
