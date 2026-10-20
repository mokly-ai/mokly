/** Workspace values derived only from the validated public catalogue. */

import { detailKey } from "../catalogue/detail_fences.js";
import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type {
  ShellCatalogueComponent,
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
} from "../catalogue/scoped_types.js";
import type { UsageLink as DetailUsageLink } from "../catalogue/types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import { generatedViews } from "../components/views.js";
import type { Catalogue } from "../shell/catalogue.js";
import type {
  EntryStatus,
  UsageLink,
  WorkspaceData,
  WorkspaceVariant,
} from "../shell/workspace_data.js";

import { displayEntry } from "./projection.js";
import { shownReasons } from "./public_reasons.js";
import { publicParent, publicVariants } from "./public_variants.js";
import {
  publishedChangedViewsBySelection,
  publishedResourceEvidence,
  publishedViewStatesBySelection,
} from "./public_workspace_views.js";

const statuses = {
  added: "Added",
  changed: "Changed",
  removed: "Removed",
  unmodified: "Unmodified",
} as const;

/** The status beside a published entry's title, once its Changes are ready. */
export function publicEntryStatus(
  entry: ShellCatalogueRoutedEntry,
): EntryStatus | undefined {
  return entry.changes.status === "ready"
    ? statuses[entry.changes.kind]
    : undefined;
}

/**
 * A variant's status from its compared views, unless they show no change:
 * then its entry's change decides, so a metadata-only edit reads Changed and
 * a pure move Unmodified.
 */
function variantStatus(
  entry: ShellCatalogueComponent,
): EntryStatus | undefined {
  const compared =
    entry.comparison.status === "ready"
      ? statuses[entry.comparison.kind]
      : undefined;
  return compared === undefined || compared === "Unmodified"
    ? (publicEntryStatus(entry) ?? compared)
    : compared;
}

/**
 * The routed entry's workspace from the index and the routed entry's detail.
 * `base` is the index's branch name; it stays empty when the index names none.
 * The detail's direct reasons that fit the record reach Details before any
 * comparison loads.
 */
export function publicWorkspace(
  catalogue: Catalogue,
  model: ShellCatalogueReadModel,
  entry: WorkspaceData["entry"],
  comparisons = model.comparisonUrl !== null,
  snapshotId?: string,
  base = "",
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
  const held = model.details.get(
    detailKey({
      path: original.path,
      ...(selected?.snapshotId ? { snapshotId: selected.snapshotId } : {}),
    }),
  );
  const detail = held?.workspace;
  const publicComponent: ShellCatalogueComponent | undefined =
    original.kind === "component"
      ? original.variantOf !== undefined
        ? publicParent(catalogue, model, original)
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
    original.variantOf !== undefined &&
    publicComponent === undefined;
  const parentRemoved = publicComponent
    ? model.removedEntries.some(({ entry }) => entry === publicComponent)
    : false;
  const rowSources: readonly ShellCatalogueComponent[] = publicComponent
    ? [
        publicComponent,
        ...publicVariants(catalogue, model, publicComponent, parentRemoved),
      ]
    : orphanVariant
      ? [original]
      : [];
  const viewUsagePending = (
    original.kind === "screen" ? [original] : rowSources
  ).some((source) =>
    source.views.some((view) => view.usage.status === "omitted"),
  );
  const entryStatus = publicEntryStatus(original);
  const reasons = shownReasons(original, removed, held?.reasons);
  const variants = rowSources.map((source) =>
    workspaceRow(model, source, parentRemoved),
  );
  const selectedVariant =
    entry.kind === "component"
      ? variants.find((variant) => variant.value.path === entry.path)
      : undefined;
  const workspaceStatus = selectedVariant?.status ?? entryStatus;
  const resourceEvidence = publishedResourceEvidence(original.views);
  return {
    entry,
    ...(component ? { component } : {}),
    components: [
      ...model.components,
      ...model.removedEntries.flatMap(({ entry }) =>
        entry.kind === "component" ? [entry] : [],
      ),
    ]
      .filter((candidate) => candidate.variantOf === undefined)
      .map(({ path, title }) => ({ path, title })),
    views:
      component || orphanVariant
        ? variants.flatMap(({ value }) => generatedViews(value))
        : generatedViews(entry),
    changedViews: publishedChangedViewsBySelection(
      publicComponent ?? original,
      rowSources,
    ),
    viewStates: publishedViewStatesBySelection(
      publicComponent ?? original,
      rowSources,
    ),
    variants,
    usedBy: (detail?.usedBy ?? []).map(shellUsageLink),
    affected: (detail?.affected ?? []).map(shellUsageLink),
    base,
    comparisons,
    comparisonEligible:
      detail?.comparisonEligible ??
      (original.kind === "screen"
        ? original.views.some(
            (view) =>
              view.comparison.status === "ready" && view.comparison.eligible,
          )
        : (selectedVariant?.comparisonEligible ?? false)),
    removed,
    relatedComponents: detail?.relatedComponents ?? [],
    inputChanges: detail?.inputChanges ?? [],
    ...(detail ? {} : { usageComplete: false }),
    ...(viewUsagePending ? { viewUsagePending: true } : {}),
    ...(workspaceStatus ? { status: workspaceStatus } : {}),
    ...(reasons ? { reasons } : {}),
    ...(resourceEvidence.length ? { resourceEvidence } : {}),
  };
}

function workspaceRow(
  model: ShellCatalogueReadModel,
  source: ShellCatalogueComponent,
  parentRemoved: boolean,
): WorkspaceVariant {
  const value = displayEntry(source);
  if (value.kind !== "component")
    throw new Error("The component entry is unavailable.");
  const record = model.removedEntries.find(
    ({ entry: candidate }) => candidate === source,
  );
  const shown = variantStatus(source);
  return {
    value,
    removed: parentRemoved || record !== undefined,
    comparisonEligible:
      source.comparison.status === "ready" && source.comparison.eligible,
    ...(record?.snapshotId ? { snapshotId: record.snapshotId } : {}),
    ...(shown ? { status: shown } : {}),
  };
}

function shellUsageLink(link: DetailUsageLink): UsageLink {
  const { entryPath, ...rest } = link;
  return { entryId: entryPath, ...rest };
}
