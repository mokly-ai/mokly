import type { ManifestComponent } from "../components/manifest_types.js";
import { isManifestComponentVariant } from "../components/manifest_types.js";
import type { RenderCapability } from "../components/render_types.js";
/** Serializable, source-derived state shared by the served and published inspector. */
import {
  generatedViews,
  orderedInstances,
  type GeneratedComponentView,
} from "../components/views.js";
import type { ManifestScreen } from "../registry/types.js";
import type {
  ChangedEntry,
  ComponentReview,
  ScreenReviewV4,
} from "../review/component_types.js";
import type { ViewResourceEvidence } from "../review/types.js";
import { publicWorkspace } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { dedupeUsageLinks } from "./usage_links.js";
import {
  shownComparisonEligible,
  type EntryStatus,
  type ViewStatesBySelection,
} from "./view_status.js";
import {
  inputChanges as entryInputChanges,
  type InputChange,
} from "./workspace_input_changes.js";
import {
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
export interface UsageLink {
  entryId: string;
  entryKind: "component" | "screen";
  title: string;
  variantId?: string;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  instanceKey: string;
  direct: boolean;
  removed: boolean;
  comparisonEligible: boolean;
}
export interface WorkspaceData {
  previewGeneration?: string;
  usageComplete?: boolean;
  renderCapability?: RenderCapability;
  entry: ManifestScreen | ManifestComponent;
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
  const currentEntriesById = new Map(
    catalogue.manifest.entries.map((candidate) => [candidate.id, candidate]),
  );
  const resourceEvidence = snapshot?.screenEvidence?.find(
    (screen) => screen.id === entry.id,
  )?.views;
  const baseline = snapshot?.baseline.entries.find(
    (item) => item.id === entry.id,
  );
  const removed = !catalogue.manifest.entries.some(
    (candidate) => candidate.id === entry.id,
  );
  const change = result?.changes.find(
    (item) => (item.after ?? item.before)?.id === entry.id,
  );
  const comparison =
    entry.kind === "component"
      ? result?.components.find((item) => item.id === entry.id)
      : result?.screens.find((item) => item.id === entry.id);
  const known = snapshot !== undefined || context.changedIds !== undefined;
  const status: EntryStatus | undefined = !known
    ? undefined
    : removed
      ? "Removed"
      : snapshot && !baseline
        ? "Added"
        : change ||
            comparison?.state === "changed" ||
            (entry.kind === "component" &&
              comparison &&
              "variants" in comparison &&
              comparison.variants.some(
                (variant) =>
                  variant.state === "added" ||
                  variant.state === "changed" ||
                  variant.state === "removed",
              )) ||
            context.changedIds?.includes(entry.id)
          ? "Changed"
          : "Unmodified";
  const variantSet =
    entry.kind === "component"
      ? workspaceVariants(
          catalogue,
          entry,
          snapshot,
          comparison && "variants" in comparison ? comparison : undefined,
          known,
          removed,
          status,
        )
      : { baseline: [], current: [], rows: [] };
  const currentVariants = variantSet.current;
  const baselineVariants = variantSet.baseline;
  const variants = variantSet.rows;
  const affected: UsageLink[] = (result?.affectedConsumers ?? [])
    .filter((item) => item.changedComponentId === entry.id)
    .flatMap((item) =>
      item.evidence.map((evidence) => {
        const current = currentEntriesById.get(evidence.context.entry.id);
        const removed = current === undefined;
        return {
          entryId: evidence.context.entry.id,
          entryKind: evidence.context.kind,
          title: evidence.context.entry.title,
          ...(evidence.context.kind === "component"
            ? { variantId: evidence.context.variantId }
            : {}),
          viewport: evidence.context.viewport,
          colorScheme: evidence.context.colorScheme,
          instanceKey: evidence.via.at(-1)!.instanceKey,
          direct: evidence.via.length === 1,
          removed,
          comparisonEligible: shownComparisonEligible(
            removed ? "Removed" : "Changed",
            evidence.context.kind,
          ),
        };
      }),
    );
  const inputChanges = entryInputChanges(
    catalogue,
    entry,
    baseline,
    currentVariants,
    baselineVariants,
  );
  const relatedIds = new Set(
    result?.affectedConsumers
      .filter((item) =>
        item.consumer.kind === "screen"
          ? item.consumer.id === entry.id
          : item.consumer.id === entry.id,
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
    removed,
    comparisons: context.comparisons ?? false,
    comparisonEligible: shownComparisonEligible(status, entry.kind),
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
    views: (entry.kind === "component"
      ? currentVariants.flatMap((variant) => generatedViews(variant))
      : generatedViews(entry)
    ).map((view) => {
      if (!context.previewGeneration || removed) return view;
      const demand = { ...view };
      delete demand.usage;
      return demand;
    }),
    changedViews: changedViewsBySelection(
      entry,
      context,
      comparison,
      variants.map(({ value }) => value.id),
    ),
    viewStates: viewStatesBySelection(
      entry,
      context,
      comparison,
      variants.map(({ value }) => value.id),
    ),
    variants,
    usedBy: (catalogue.manifest.schemaVersion === "live-index-1"
      ? []
      : catalogue.manifest.entries
    ).flatMap((owner) => {
      if (owner.kind !== "screen" && owner.kind !== "component") return [];
      return generatedViews(owner).flatMap((view) =>
        orderedInstances(view.usage)
          .filter((instance) => instance.componentId === entry.id)
          .map((instance) => ({
            entryId:
              owner.kind === "component" && isManifestComponentVariant(owner)
                ? owner.variantOf
                : owner.id,
            entryKind: owner.kind,
            title:
              owner.kind === "component" && isManifestComponentVariant(owner)
                ? (catalogue.byId.get(owner.variantOf)?.title ?? owner.title)
                : owner.title,
            viewport: view.viewport,
            colorScheme: view.colorScheme,
            ...(view.variantId ? { variantId: view.variantId } : {}),
            instanceKey: instance.key,
            direct: instance.owner.kind === "entry",
            removed: false,
            comparisonEligible: false,
          })),
      );
    }),
    affected: dedupeUsageLinks(affected),
    ...(status ? { status } : {}),
    ...(change ? { change } : {}),
    ...(comparison ? { comparison } : {}),
    ...(resourceEvidence ? { resourceEvidence } : {}),
  };
}
