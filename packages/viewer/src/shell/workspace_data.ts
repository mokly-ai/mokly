import { branchPoints } from "../catalogue/branch_point.js";
import type { ManifestComponent } from "../components/manifest_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import type { RenderCapability } from "../components/render_types.js";
/** Serializable, source-derived state shared by the served and published inspector. */
import {
  generatedViews,
  type GeneratedComponentView,
} from "../components/views.js";
import type {
  ChangedEntry,
  ComponentReview,
  ScreenReviewV5,
} from "../review/component_types.js";
import type { ViewResourceEvidence } from "../review/types.js";
import { publicWorkspace } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import { materialChangedEntries, type ShellContext } from "./context.js";
import {
  shownComparisonEligible,
  type EntryStatus,
  type ViewStatesBySelection,
} from "./view_status.js";
import {
  componentReview,
  workspaceComponent,
  type WorkspaceEntry,
} from "./workspace_entry.js";
import {
  inputChanges as entryInputChanges,
  type InputChange,
} from "./workspace_input_changes.js";
import {
  affectedUsageLinks,
  usedByUsageLinks,
  type UsageLink,
} from "./workspace_usage_data.js";
import {
  standaloneWorkspaceVariant,
  workspaceVariants,
  type WorkspaceVariant,
} from "./workspace_variants.js";
import {
  changedViewsBySelection,
  type ChangedViewsBySelection,
  viewStatesBySelection,
} from "./workspace_views_data.js";

export type { EntryStatus } from "./view_status.js";
export type { WorkspaceVariant } from "./workspace_variants.js";
export type { UsageLink } from "./workspace_usage_data.js";
export interface WorkspaceData {
  previewGeneration?: string;
  usageComplete?: boolean;
  /** Selected public views are waiting for route-scoped usage evidence. */
  viewUsagePending?: boolean;
  renderCapability?: RenderCapability;
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
  change?: ChangedEntry;
  comparison?: ComponentReview | ScreenReviewV5;
  resourceEvidence?: readonly ViewResourceEvidence[];
  base: string;
  comparisons: boolean;
  comparisonEligible: boolean;
  removed: boolean;
  relatedComponents: readonly { path: string; title: string }[];
  inputChanges: readonly InputChange[];
}

/** Entry state and actual saved views stay independent of Changes membership. */
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
    );
  const snapshot = context.componentChanges;
  const result = snapshot?.result;
  const component = workspaceComponent(catalogue, entry);
  const orphanVariant =
    entry.kind === "component" &&
    isManifestComponentVariant(entry) &&
    component === undefined;
  const componentComparison =
    entry.kind === "component"
      ? componentReview(result?.components, component, entry)
      : undefined;
  const componentId = component?.path ?? componentComparison?.path;
  const evidenceEntry = component ?? entry;
  const resourceEvidence = snapshot?.screenEvidence?.find(
    (screen) => screen.path === entry.path,
  )?.views;
  const baseline =
    snapshot &&
    branchPoints(catalogue).baselineEntry(
      evidenceEntry,
      snapshot.baseline.entries,
    );
  const removed = !catalogue.manifest.entries.some(
    (candidate) => candidate.path === entry.path,
  );
  const change = result?.changes.find(
    (item) => (item.after ?? item.before)?.path === entry.path,
  );
  /** A pure move is in Changes without changing, so it is not material. */
  const materialChanges = materialChangedEntries(context);
  const pureMove =
    change?.previousPath !== undefined && change.reasons.length === 0;
  const comparison =
    entry.kind === "component"
      ? componentComparison
      : result?.screens.find((item) => item.path === entry.path);
  const known = snapshot !== undefined || context.changedEntries !== undefined;
  const entryStatus: EntryStatus | undefined = !known
    ? undefined
    : removed
      ? "Removed"
      : snapshot && !baseline
        ? "Added"
        : (change && !pureMove) ||
            (entry.kind === "screen" && comparison?.state === "changed") ||
            (!pureMove && materialChanges?.includes(entry.path))
          ? "Changed"
          : "Unmodified";
  const variantSet = component
    ? workspaceVariants(
        catalogue,
        component,
        snapshot,
        componentComparison,
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
          snapshot,
          componentComparison,
          known,
          removed,
          entryStatus,
          context.snapshotId,
        )
      : { baseline: [], current: [], rows: [] };
  const currentVariants = variantSet.current;
  const baselineVariants = variantSet.baseline;
  const variants = variantSet.rows;
  const selectedVariant =
    entry.kind === "component" && isManifestComponentVariant(entry)
      ? variants.find((variant) => variant.value.path === entry.path)
      : undefined;
  const status = selectedVariant?.status ?? entryStatus;
  const inputChanges = entryInputChanges(
    catalogue,
    evidenceEntry,
    baseline,
    snapshot?.baseline.entries ?? [],
    currentVariants,
    baselineVariants,
  );
  const relatedIds = new Set(
    result?.affectedConsumers
      .filter((item) =>
        item.consumer.kind === "screen"
          ? item.consumer.path === entry.path
          : item.consumer.path === componentId,
      )
      .map((item) => item.changedComponentId),
  );
  return {
    ...(context.previewGeneration
      ? { previewGeneration: context.previewGeneration }
      : {}),
    ...(catalogue.manifest.schemaVersion === "live-index-1"
      ? {
          usageComplete: false,
        }
      : {}),
    ...(entry.kind === "component" && context.renderCapability
      ? { renderCapability: context.renderCapability }
      : {}),
    entry,
    ...(component ? { component } : {}),
    removed,
    comparisons: context.comparisons ?? false,
    comparisonEligible:
      selectedVariant?.comparisonEligible ??
      shownComparisonEligible(status, entry.kind),
    base: context.base,
    inputChanges,
    relatedComponents: (result?.components ?? [])
      .filter((item) => {
        const routed = catalogue.byPath.get(item.path);
        return relatedIds.has(item.path) && routed?.kind === "component";
      })
      .map(({ path, title }) => ({ path, title })),
    components: [...catalogue.manifest.entries, ...catalogue.removedComponents]
      .filter(
        (item): item is ManifestComponent =>
          item.kind === "component" && !isManifestComponentVariant(item),
      )
      .map(({ path, title }) => ({ path, title })),
    views: (component
      ? currentVariants.flatMap((variant) => generatedViews(variant))
      : generatedViews(entry)
    ).map((view) => {
      if (!context.previewGeneration || removed) return view;
      const demand = { ...view };
      delete demand.usage;
      return demand;
    }),
    changedViews: changedViewsBySelection(
      evidenceEntry,
      context,
      comparison,
      variants.map(({ value }) => value.path),
    ),
    viewStates: viewStatesBySelection(
      evidenceEntry,
      context,
      comparison,
      variants.map(({ value }) => value.path),
    ),
    variants,
    usedBy: usedByUsageLinks(catalogue, evidenceEntry),
    affected: affectedUsageLinks(catalogue, result, componentId),
    ...(status ? { status } : {}),
    ...(change ? { change } : {}),
    ...(comparison ? { comparison } : {}),
    ...(resourceEvidence ? { resourceEvidence } : {}),
  };
}
