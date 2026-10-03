/** Workspace values derived only from the validated public catalogue. */

import {
  catalogueComponentVariants,
  resolveCatalogueSelection,
} from "../catalogue/entry_selection.js";
import type {
  ShellCatalogueComponent,
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueVariant,
} from "../catalogue/scoped_types.js";
import { catalogueHasOmittedUsage } from "../catalogue/usage_scope.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import { generatedViews } from "../components/views.js";
import type {
  EntryStatus,
  UsageLink,
  WorkspaceData,
} from "../shell/workspace_data.js";

import { displayEntry } from "./projection.js";
import {
  publishedChangedViewsBySelection,
  publishedResourceEvidence,
  publishedViewStatesBySelection,
} from "./public_workspace_views.js";
import { routedEntries } from "./selection.js";

const statuses = {
  added: "Added",
  changed: "Changed",
  removed: "Removed",
  unmodified: "Unmodified",
} as const;

function status(entry: ShellCatalogueRoutedEntry): EntryStatus | undefined {
  return entry.changes.status === "ready"
    ? statuses[entry.changes.kind]
    : undefined;
}

export function publicWorkspace(
  model: ShellCatalogueReadModel,
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
  const publicComponent: ShellCatalogueComponent | undefined =
    original.kind === "component"
      ? "variantOf" in original
        ? (model.components.find(
            (candidate): candidate is ShellCatalogueComponent =>
              candidate.id === original.variantOf &&
              !("variantOf" in candidate),
          ) ??
          model.removedEntries
            .map(({ entry }) => entry)
            .find(
              (candidate): candidate is ShellCatalogueComponent =>
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
  const sourceVariants: readonly ShellCatalogueVariant[] = publicComponent
    ? catalogueComponentVariants(model, publicComponent.id)
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
  const variants =
    component || orphanVariant
      ? sourceVariants.map((source) => {
          const value = displayEntry(source);
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
  const resourceEvidence = publishedResourceEvidence(
    original.kind === "screen" || "variantOf" in original
      ? original.views
      : (sourceVariants[0]?.views ?? []),
  );
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
    ...(viewUsagePending ? { viewUsagePending: true } : {}),
    ...(workspaceStatus ? { status: workspaceStatus } : {}),
    ...(resourceEvidence.length ? { resourceEvidence } : {}),
  };
}

function publicEntryTitle(
  model: ShellCatalogueReadModel,
  entry: Extract<ShellCatalogueRoutedEntry, { kind: "component" | "screen" }>,
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
