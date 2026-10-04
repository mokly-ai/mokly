/** Workspace values derived only from the validated public catalogue. */

import {
  catalogueComponentParent,
  catalogueComponentVariants,
  resolveCatalogueSelection,
} from "../catalogue/entry_selection.js";
import type {
  ShellCatalogueComponent,
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
  ShellCatalogueVariant,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import { catalogueHasOmittedUsage } from "../catalogue/usage_scope.js";
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

function status(entry: ShellCatalogueRoutedEntry): EntryStatus | undefined {
  return entry.changes.status === "ready"
    ? statuses[entry.changes.kind]
    : undefined;
}

/**
 * A variant's status from its compared views, unless they show no change:
 * then its entry's change decides, so a metadata-only edit reads Changed and
 * a pure move Unmodified.
 */
function variantStatus(entry: ShellCatalogueVariant): EntryStatus | undefined {
  const compared =
    entry.comparison.status === "ready"
      ? statuses[entry.comparison.kind]
      : undefined;
  return compared === undefined || compared === "Unmodified"
    ? (status(entry) ?? compared)
    : compared;
}

/** Published per-view comparisons name the same changed views the shell derives. */
function publishedChangedViews(
  views: readonly ShellCatalogueView[],
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
  entry: ShellCatalogueScreen | ShellCatalogueComponent | ShellCatalogueVariant,
  variants: readonly ShellCatalogueVariant[] = [],
): ChangedViewsBySelection {
  if (entry.kind === "screen")
    return { [entry.path]: publishedChangedViews(entry.views) };
  return Object.fromEntries(
    variants.map((variant) => [
      variant.path,
      publishedChangedViews(variant.views),
    ]),
  );
}

/** Keep only published views whose comparison state is ready. */
function publishedViewStates(
  views: readonly ShellCatalogueView[],
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
  entry: ShellCatalogueScreen | ShellCatalogueComponent | ShellCatalogueVariant,
  variants: readonly ShellCatalogueVariant[] = [],
): ViewStatesBySelection {
  if (entry.kind === "screen") {
    const states = publishedViewStates(entry.views);
    return states === undefined
      ? (Object.create(null) as Record<string, readonly ViewState[]>)
      : { [entry.path]: states };
  }
  const evidence: Record<string, readonly ViewState[]> = Object.create(null);
  for (const variant of variants) {
    const states = publishedViewStates(variant.views);
    if (states !== undefined) evidence[variant.path] = states;
  }
  return evidence;
}

export function publicWorkspace(
  model: ShellCatalogueReadModel,
  entry: WorkspaceData["entry"],
  comparisons = model.comparisonUrl !== null,
  snapshotId?: string,
): WorkspaceData {
  const selected = resolveCatalogueSelection(model, entry.path, snapshotId);
  const original =
    selected?.entry.kind === entry.kind ? selected.entry : undefined;
  if (
    !original ||
    (original.kind !== "screen" && original.kind !== "component")
  )
    throw new Error("The selected item is unavailable.");
  const removed = model.removedEntries.some((item) => item.entry === original);
  const publicComponent: ShellCatalogueComponent | undefined =
    original.kind === "component"
      ? "variantOf" in original
        ? catalogueComponentParent(model, original.variantOf)
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
    component?.path ?? (orphanVariant ? original.variantOf : undefined);
  const parentRemoved = publicComponent
    ? model.removedEntries.some(({ entry }) => entry === publicComponent)
    : false;
  const sourceVariants: readonly ShellCatalogueVariant[] = publicComponent
    ? catalogueComponentVariants(model, publicComponent.path)
    : orphanVariant
      ? [original]
      : [];
  const scoped = catalogueHasOmittedUsage(model);
  const viewUsagePending =
    original.kind === "screen"
      ? original.views.some((view) => view.usage.status === "omitted")
      : sourceVariants.some((variant) =>
          variant.views.some((view) => view.usage.status === "omitted"),
        );
  const usedBy: UsageLink[] = [];
  if (!scoped)
    for (const owner of routedEntries(model)) {
      if (owner.kind !== "screen" && owner.kind !== "component") continue;
      for (const view of generatedViews(displayEntry(owner)))
        for (const instance of view.usage?.instances ?? [])
          if (instance.componentId === (componentId ?? entry.path))
            usedBy.push({
              entryId: owner.path,
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
  const variants =
    component || orphanVariant
      ? sourceVariants.map((source) => {
          const value = displayEntry(source);
          const shown = variantStatus(source);
          const sourceSnapshotId = model.removedEntries.find(
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
              ),
            comparisonEligible:
              source.comparison.status === "ready" &&
              source.comparison.eligible,
            ...(sourceSnapshotId ? { snapshotId: sourceSnapshotId } : {}),
            ...(shown ? { status: shown } : {}),
          };
        })
      : [];
  const selectedVariant =
    entry.kind === "component" && isManifestComponentVariant(entry)
      ? variants.find((variant) => variant.value.path === entry.path)
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
        (candidate): candidate is ShellCatalogueComponent =>
          !("variantOf" in candidate),
      )
      .map(({ path, title }) => ({ path, title })),
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
    ...(viewUsagePending ? { viewUsagePending: true } : {}),
    ...(workspaceStatus ? { status: workspaceStatus } : {}),
  };
}

function publicEntryTitle(
  model: ShellCatalogueReadModel,
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "component" | "screen" }>,
): string {
  if (entry.kind !== "component" || !("variantOf" in entry)) return entry.title;
  const parent = catalogueComponentParent(model, entry.variantOf);
  return parent ? `${parent.title} · ${entry.title}` : entry.title;
}
