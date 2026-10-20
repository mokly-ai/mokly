import type { InputChange } from "../catalogue/types.js";
import type { ManifestComponent } from "../components/manifest_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
/** Serializable, source-derived state shared by every delivery's inspector. */
import {
  generatedViews,
  type GeneratedComponentView,
} from "../components/views.js";
import type {
  EntryChangeReason,
  ViewResourceEvidence,
} from "../review/types.js";
import { publicWorkspace } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import { materialChangedEntries, type ShellContext } from "./context.js";
import {
  shownComparisonEligible,
  type EntryStatus,
  type ViewStatesBySelection,
} from "./view_status.js";
import { workspaceComponent, type WorkspaceEntry } from "./workspace_entry.js";
import { usedByUsageLinks, type UsageLink } from "./workspace_usage_data.js";
import {
  standaloneWorkspaceVariant,
  workspaceVariants,
  type WorkspaceVariant,
} from "./workspace_variants.js";
import type { ChangedViewsBySelection } from "./workspace_views_data.js";

export type { EntryStatus } from "./view_status.js";
export type { WorkspaceVariant } from "./workspace_variants.js";
export type { UsageLink } from "./workspace_usage_data.js";
export interface WorkspaceData {
  /** False when no detail carried the Usage lists of this entry. */
  usageComplete?: boolean;
  /** Selected views are waiting for the routed entry's detail. */
  viewUsagePending?: boolean;
  /** The exact routed entry whose chrome and lifecycle own this workspace. */
  entry: WorkspaceEntry;
  /** Parent schema and controls for a component parent or variant route. */
  component?: ManifestComponent;
  components: readonly Pick<ManifestComponent, "path" | "title">[];
  views: readonly GeneratedComponentView[];
  /**
   * Canonically ordered changed views, keyed by saved-variant id for a
   * component and by the entry id for a screen.
   */
  changedViews: ChangedViewsBySelection;
  /**
   * Known review states keyed by saved-variant id for a component and by the
   * entry id for a screen. A missing key means the per-view state is unknown.
   */
  viewStates: ViewStatesBySelection;
  variants: readonly WorkspaceVariant[];
  usedBy: readonly UsageLink[];
  affected: readonly UsageLink[];
  status?: EntryStatus;
  /** Whether Changes lists the routed entry; absent until Changes is ready. */
  included?: boolean;
  /**
   * The routed entry's direct reasons from its detail, while Changes is
   * ready and includes it; a pure move has none.
   */
  reasons?: readonly EntryChangeReason[];
  /**
   * A shown view's entry-detail evidence keeps a retained rule or a resource
   * that a component owns.
   */
  componentRecords?: boolean;
  resourceEvidence?: readonly ViewResourceEvidence[];
  base: string;
  comparisons: boolean;
  comparisonEligible: boolean;
  removed: boolean;
  relatedComponents: readonly { path: string; title: string }[];
  inputChanges: readonly InputChange[];
}

/**
 * Entry state and actual saved views stay independent of Changes membership.
 * A published catalogue supplies every comparison fact. A catalogue without
 * published records knows only the context's Changes lists, so its workspace
 * carries statuses and no comparison evidence.
 */
export function workspaceData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: WorkspaceData["entry"],
): WorkspaceData {
  if (catalogue.publicModel)
    return publicWorkspace(
      catalogue,
      catalogue.publicModel,
      entry,
      context.comparisons ?? catalogue.publicModel.comparisonUrl !== null,
      context.snapshotId,
      context.base,
    );
  const component = workspaceComponent(catalogue, entry);
  const orphanVariant =
    entry.kind === "component" &&
    isManifestComponentVariant(entry) &&
    component === undefined;
  const evidenceEntry = component ?? entry;
  const removed = !catalogue.manifest.entries.some(
    (candidate) => candidate.path === entry.path,
  );
  const materialChanges = materialChangedEntries(context);
  const known = context.changedEntries !== undefined;
  const entryStatus: EntryStatus | undefined = !known
    ? undefined
    : removed
      ? "Removed"
      : materialChanges?.includes(entry.path)
        ? "Changed"
        : "Unmodified";
  const variantSet = component
    ? workspaceVariants(
        catalogue,
        component,
        known,
        !catalogue.manifest.entries.some(
          (candidate) => candidate.path === component.path,
        ),
        entry.path === component.path ? entryStatus : undefined,
        materialChanges,
      )
    : orphanVariant
      ? standaloneWorkspaceVariant(
          entry,
          known,
          removed,
          entryStatus,
          context.snapshotId,
        )
      : { current: [], rows: [] };
  const variants = variantSet.rows;
  const selectedVariant =
    entry.kind === "component" && isManifestComponentVariant(entry)
      ? variants.find((variant) => variant.value.path === entry.path)
      : undefined;
  const status = selectedVariant?.status ?? entryStatus;
  return {
    ...(catalogue.manifest.schemaVersion === "live-index-2"
      ? {
          usageComplete: false,
        }
      : {}),
    entry,
    ...(component ? { component } : {}),
    removed,
    comparisons: context.comparisons ?? false,
    comparisonEligible:
      selectedVariant?.comparisonEligible ??
      shownComparisonEligible(status, entry.kind),
    base: context.base,
    inputChanges: [],
    relatedComponents: [],
    components: [...catalogue.manifest.entries, ...catalogue.removedComponents]
      .filter(
        (item): item is ManifestComponent =>
          item.kind === "component" && !isManifestComponentVariant(item),
      )
      .map(({ path, title }) => ({ path, title })),
    views: component
      ? variantSet.current.flatMap((variant) => generatedViews(variant))
      : generatedViews(entry),
    changedViews:
      evidenceEntry.kind === "screen" ? { [evidenceEntry.path]: [] } : {},
    viewStates: {},
    variants,
    usedBy: usedByUsageLinks(catalogue, evidenceEntry),
    affected: [],
    ...(status ? { status } : {}),
    ...(context.changedEntries
      ? { included: context.changedEntries.includes(entry.path) }
      : {}),
  };
}
