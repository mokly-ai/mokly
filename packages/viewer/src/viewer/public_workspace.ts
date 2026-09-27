/** Workspace values derived only from the validated public catalogue. */
import { catalogueComponentVariants } from "../catalogue/entry_selection.js";
import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type {
  CatalogueComponent,
  CatalogueComponentVariant,
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueView,
} from "../catalogue/types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
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
function status(entry: CatalogueRecord): EntryStatus | undefined {
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
  entry: CatalogueScreen | CatalogueComponent | CatalogueComponentVariant,
  variants: readonly CatalogueComponentVariant[] = [],
): ChangedViewsBySelection {
  if (entry.kind === "screen")
    return { [entry.id]: publishedChangedViews(entry.views) };
  return Object.fromEntries(
    variants.map((variant) => [
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
  entry: CatalogueScreen | CatalogueComponent | CatalogueComponentVariant,
  variants: readonly CatalogueComponentVariant[] = [],
): ViewStatesBySelection {
  if (entry.kind === "screen") {
    const states = publishedViewStates(entry.views);
    return states === undefined ? {} : { [entry.id]: states };
  }
  const evidence: Record<string, readonly ViewState[]> = {};
  for (const variant of variants) {
    const states = publishedViewStates(variant.views);
    if (states !== undefined) evidence[variant.id] = states;
  }
  return evidence;
}

export function publicWorkspace(
  model: CatalogueReadModel,
  entry: WorkspaceData["entry"],
  comparisons = model.comparisonUrl !== null,
  snapshotId?: string,
): WorkspaceData {
  const selected = resolveCatalogueSelection(model, entry.id, snapshotId);
  const original =
    selected?.entry.kind === entry.kind ? selected.entry : undefined;
  if (
    !original ||
    (original.kind !== "screen" && original.kind !== "component")
  )
    throw new Error("The selected item is unavailable.");
  const removed = model.removedEntries.some((item) => item.entry === original);
  const publicComponent: CatalogueComponent | undefined =
    original.kind === "component"
      ? "variantOf" in original
        ? (model.components.find(
            (candidate): candidate is CatalogueComponent =>
              candidate.id === original.variantOf &&
              !("variantOf" in candidate),
          ) ??
          model.removedEntries
            .map(({ entry }) => entry)
            .find(
              (candidate): candidate is CatalogueComponent =>
                candidate.kind === "component" &&
                candidate.id === original.variantOf &&
                !("variantOf" in candidate),
            ))
        : original
      : undefined;
  const projectedComponent = publicComponent
    ? displayEntry(publicComponent)
    : undefined;
  const component =
    projectedComponent?.kind === "component" &&
    !isManifestComponentVariant(projectedComponent)
      ? projectedComponent
      : undefined;
  if (publicComponent && !component)
    throw new Error("The component parent is unavailable.");
  const orphanVariant =
    original.kind === "component" &&
    "variantOf" in original &&
    publicComponent === undefined;
  const componentId =
    component?.id ?? (orphanVariant ? original.variantOf : undefined);
  const parentRemoved = publicComponent
    ? model.removedEntries.some(({ entry }) => entry === publicComponent)
    : false;
  const usedBy: UsageLink[] = [];
  for (const owner of routedEntries(model)) {
    if (owner.kind !== "screen" && owner.kind !== "component") continue;
    for (const view of generatedViews(displayEntry(owner)))
      for (const instance of view.usage?.instances ?? [])
        if (instance.componentId === (componentId ?? entry.id))
          usedBy.push({
            entryId: owner.id,
            entryKind: owner.kind,
            title: publicEntryTitle(model, owner),
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
  const sourceVariants = publicComponent
    ? catalogueComponentVariants(model, publicComponent.id)
    : orphanVariant
      ? [original]
      : [];
  const variants =
    component || orphanVariant
      ? sourceVariants.map((source) => {
          const value = displayEntry(source);
          const snapshotId = model.removedEntries.find(
            ({ entry: candidate }) => candidate === source,
          )?.snapshotId;
          if (value.kind !== "component" || !("variantOf" in value))
            throw new Error("The component variant is unavailable.");
          return {
            value,
            removed:
              parentRemoved ||
              model.removedEntries.some(
                ({ entry: candidate }) => candidate === source,
              ) ||
              (source.comparison.status === "ready" &&
                source.comparison.kind === "removed"),
            comparisonEligible:
              source.comparison.status === "ready" &&
              source.comparison.eligible,
            ...(snapshotId ? { snapshotId } : {}),
            ...(source.comparison.status === "ready"
              ? { status: statuses[source.comparison.kind] }
              : source.changes.status === "ready"
                ? { status: statuses[source.changes.kind] }
                : {}),
          };
        })
      : [];
  const selectedVariant =
    entry.kind === "component" && isManifestComponentVariant(entry)
      ? variants.find((variant) => variant.value.id === entry.id)
      : undefined;
  const workspaceStatus = selectedVariant?.status ?? entryStatus;
  return {
    entry,
    ...(component ? { component } : {}),
    components: [
      ...model.components,
      ...model.removedEntries.flatMap(({ entry }) =>
        entry.kind === "component" && !("variantOf" in entry) ? [entry] : [],
      ),
    ]
      .filter(
        (component): component is CatalogueComponent =>
          !("variantOf" in component),
      )
      .map(({ id, title }) => ({ id, title })),
    views:
      component || orphanVariant
        ? variants.flatMap(({ value }) => generatedViews(value))
        : generatedViews(entry),
    changedViews: publishedChangedViewsBySelection(
      publicComponent ?? original,
      sourceVariants,
    ),
    viewStates: publishedViewStatesBySelection(
      publicComponent ?? original,
      sourceVariants,
    ),
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
        : (selectedVariant?.comparisonEligible ??
          variants[0]?.comparisonEligible ??
          false),
    removed,
    relatedComponents: [],
    inputChanges: [],
    ...(workspaceStatus ? { status: workspaceStatus } : {}),
  };
}

function publicEntryTitle(
  model: CatalogueReadModel,
  entry: Extract<CatalogueRecord, { kind: "component" | "screen" }>,
): string {
  if (entry.kind !== "component" || !("variantOf" in entry)) return entry.title;
  const parent = [
    ...model.components,
    ...model.removedEntries.map(({ entry: candidate }) => candidate),
  ].find(
    (candidate) =>
      candidate.kind === "component" &&
      !("variantOf" in candidate) &&
      candidate.id === entry.variantOf,
  );
  return parent ? `${parent.title} · ${entry.title}` : entry.title;
}
