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
  ScreenReviewV4,
} from "../review/component_types.js";
import type { ViewResourceEvidence } from "../review/types.js";
import { publicWorkspace } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import {
  shownComparisonEligible,
  type EntryStatus,
  type ViewStatesBySelection,
} from "./view_status.js";
import { workspaceComponent, type WorkspaceEntry } from "./workspace_entry.js";
import {
  inputChanges as entryInputChanges,
  type InputChange,
} from "./workspace_input_changes.js";
import { workspaceEntryWithoutInteractive } from "./workspace_privacy.js";
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
  /** Private local-Serve eligibility; absence never enables Live. */
  interactive?: boolean;
  previewGeneration?: string;
  usageComplete?: boolean;
  /** Selected public views are waiting for route-scoped usage evidence. */
  viewUsagePending?: boolean;
  renderCapability?: RenderCapability;
  /** The exact routed entry whose chrome and lifecycle own this workspace. */
  entry: WorkspaceEntry;
  /** Parent schema and controls for a component parent or variant route. */
  component?: ManifestComponent;
  components: readonly Pick<ManifestComponent, "id" | "title">[];
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
  comparison?: ComponentReview | ScreenReviewV4;
  resourceEvidence?: readonly ViewResourceEvidence[];
  base: string;
  comparisons: boolean;
  comparisonEligible: boolean;
  removed: boolean;
  relatedComponents: readonly { id: string; title: string }[];
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
  const componentId =
    component?.id ?? (orphanVariant ? entry.variantOf : undefined);
  const evidenceEntry = component ?? entry;
  const resourceEvidence = snapshot?.screenEvidence?.find(
    (screen) => screen.id === entry.id,
  )?.views;
  const baseline = snapshot?.baseline.entries.find(
    (item) => item.id === evidenceEntry.id,
  );
  const removed = !catalogue.manifest.entries.some(
    (candidate) => candidate.id === entry.id,
  );
  const interactive =
    context.interactive &&
    !context.delivery &&
    !removed &&
    context.workspaceInteractive?.entryId === entry.id &&
    context.workspaceInteractive.entryKind === entry.kind
      ? context.workspaceInteractive.value
      : undefined;
  const change = result?.changes.find(
    (item) => (item.after ?? item.before)?.id === entry.id,
  );
  const comparison = componentId
    ? result?.components.find((item) => item.id === componentId)
    : result?.screens.find((item) => item.id === entry.id);
  const known = snapshot !== undefined || context.changedIds !== undefined;
  const entryStatus: EntryStatus | undefined = !known
    ? undefined
    : removed
      ? "Removed"
      : snapshot && !baseline
        ? "Added"
        : change ||
            (entry.kind === "screen" && comparison?.state === "changed") ||
            context.changedIds?.includes(entry.id)
          ? "Changed"
          : "Unmodified";
  const componentComparison =
    comparison && "variants" in comparison ? comparison : undefined;
  const variantSet = component
    ? workspaceVariants(
        catalogue,
        component,
        snapshot,
        componentComparison,
        known,
        !catalogue.manifest.entries.some(
          (candidate) => candidate.id === component.id,
        ),
        entry.id === component.id ? entryStatus : undefined,
        context.changedIds,
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
      ? variants.find((variant) => variant.value.id === entry.id)
      : undefined;
  const status = selectedVariant?.status ?? entryStatus;
  const inputChanges = entryInputChanges(
    catalogue,
    evidenceEntry,
    baseline,
    currentVariants,
    baselineVariants,
  );
  const relatedIds = new Set(
    result?.affectedConsumers
      .filter((item) =>
        item.consumer.kind === "screen"
          ? item.consumer.id === entry.id
          : item.consumer.id === componentId,
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
    ...(interactive === undefined ? {} : { interactive }),
    entry: workspaceEntryWithoutInteractive(entry),
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
        const routed = catalogue.byId.get(item.id);
        return relatedIds.has(item.id) && routed?.kind === "component";
      })
      .map(({ id, title }) => ({ id, title })),
    components: [...catalogue.manifest.entries, ...catalogue.removedComponents]
      .filter(
        (item): item is ManifestComponent =>
          item.kind === "component" && !isManifestComponentVariant(item),
      )
      .map(({ id, title }) => ({ id, title })),
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
      variants.map(({ value }) => value.id),
    ),
    viewStates: viewStatesBySelection(
      evidenceEntry,
      context,
      comparison,
      variants.map(({ value }) => value.id),
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
