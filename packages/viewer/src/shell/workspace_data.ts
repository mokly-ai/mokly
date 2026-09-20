import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
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
  ScreenReviewV3,
} from "../review/component_types.js";
import type { ViewResourceEvidence } from "../review/types.js";
import { publicWorkspace } from "../viewer/public_workspace.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { dedupeUsageLinks } from "./usage_links.js";
import type { ChangedView } from "./view_marks.js";
import {
  inputChanges as entryInputChanges,
  type InputChange,
} from "./workspace_input_changes.js";
import { changedViews } from "./workspace_views_data.js";

export type EntryStatus = "Added" | "Changed" | "Removed" | "Unmodified";
export interface WorkspaceVariant {
  value: ManifestComponentVariant;
  removed: boolean;
  comparisonEligible: boolean;
  status?: EntryStatus;
}
export interface UsageLink {
  title: string;
  route: string;
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
  components: readonly Pick<ManifestComponent, "id" | "title" | "route">[];
  views: readonly GeneratedComponentView[];
  /** Views a ready classification marked changed, in canonical order. */
  changedViews: readonly ChangedView[];
  variants: readonly WorkspaceVariant[];
  usedBy: readonly UsageLink[];
  affected: readonly UsageLink[];
  status?: EntryStatus;
  change?: ChangedEntry;
  comparison?: ComponentReview | ScreenReviewV3;
  resourceEvidence?: readonly ViewResourceEvidence[];
  base: string;
  comparisons: boolean;
  comparisonEligible: boolean;
  removed: boolean;
  relatedComponents: readonly { title: string; route: string }[];
  inputChanges: readonly InputChange[];
}

/** Screens compare edits; component variants also retain removed saved values. */
function isComparisonEligible(
  status: EntryStatus | undefined,
  kind: WorkspaceData["entry"]["kind"],
): boolean {
  return status === "Changed" || (kind === "component" && status === "Removed");
}

/** Entry state and actual saved views stay independent of Changes membership. */
export function workspaceData(
  catalogue: Catalogue,
  context: ShellContext,
  entry: WorkspaceData["entry"],
): WorkspaceData {
  if (catalogue.publicModel)
    return publicWorkspace(catalogue.publicModel, entry);
  const snapshot = context.componentChanges;
  const result = snapshot?.result;
  const resourceEvidence = snapshot?.screenEvidence?.find(
    (screen) => screen.route === entry.route,
  )?.views;
  const baseline = snapshot?.baseline.entries.find((item) =>
    entry.kind === "component"
      ? item.id === entry.id
      : item.kind !== "collection" && item.route === entry.route,
  );
  const removed = !catalogue.byRoute.has(entry.route);
  const change = result?.changes.find((item) =>
    entry.kind === "component"
      ? (item.after ?? item.before)?.id === entry.id
      : (item.after ?? item.before)?.route === entry.route,
  );
  const comparison =
    entry.kind === "component"
      ? result?.components.find((item) => item.id === entry.id)
      : result?.screens.find((item) => item.route === entry.route);
  const known = snapshot !== undefined || context.changedRoutes !== undefined;
  const status: EntryStatus | undefined = !known
    ? undefined
    : removed
      ? "Removed"
      : snapshot && !baseline
        ? "Added"
        : change ||
            comparison?.state === "changed" ||
            context.changedRoutes?.includes(entry.route)
          ? "Changed"
          : "Unmodified";
  const previous = baseline?.kind === "component" ? baseline.variants : [];
  const variants: WorkspaceVariant[] =
    entry.kind !== "component"
      ? []
      : [
          ...entry.variants,
          ...previous.filter(
            (item) => !entry.variants.some((current) => current.id === item.id),
          ),
        ].map((value) => {
          const review =
            comparison && "variants" in comparison
              ? comparison.variants.find((item) => item.id === value.id)
              : undefined;
          const isRemoved =
            removed || !entry.variants.some((item) => item.id === value.id);
          const variantStatus = !known
            ? undefined
            : isRemoved
              ? "Removed"
              : review?.state === "added"
                ? "Added"
                : review?.state === "changed" ||
                    (review?.before &&
                      review.after &&
                      JSON.stringify(review.before.props) !==
                        JSON.stringify(review.after.props))
                  ? "Changed"
                  : status === "Added"
                    ? "Added"
                    : "Unmodified";
          return {
            value,
            removed: isRemoved,
            comparisonEligible: isComparisonEligible(
              variantStatus,
              "component",
            ),
            ...(variantStatus ? { status: variantStatus } : {}),
          };
        });
  const affected: UsageLink[] = (result?.affectedConsumers ?? [])
    .filter((item) => item.changedComponentId === entry.id)
    .flatMap((item) =>
      item.evidence.map((evidence) => {
        const removed = !catalogue.byRoute.has(evidence.context.entry.route);
        return {
          title: evidence.context.entry.title,
          route: evidence.context.entry.route,
          ...(evidence.context.kind === "component"
            ? { variantId: evidence.context.variantId }
            : {}),
          viewport: evidence.context.viewport,
          colorScheme: evidence.context.colorScheme,
          instanceKey: evidence.via.at(-1)!.instanceKey,
          direct: evidence.via.length === 1,
          removed,
          comparisonEligible: isComparisonEligible(
            removed ? "Removed" : "Changed",
            evidence.context.kind,
          ),
        };
      }),
    );
  const inputChanges = entryInputChanges(catalogue, entry, baseline);
  const relatedIds = new Set(
    result?.affectedConsumers
      .filter((item) =>
        item.consumer.kind === "screen"
          ? item.consumer.route === entry.route
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
          ...(context.renderCapability
            ? { previewGeneration: context.renderCapability.generation }
            : {}),
        }
      : {}),
    ...(entry.kind === "component" && context.renderCapability
      ? { renderCapability: context.renderCapability }
      : {}),
    entry,
    removed,
    comparisons: context.comparisons ?? false,
    comparisonEligible: isComparisonEligible(status, entry.kind),
    base: context.base,
    inputChanges,
    relatedComponents: (result?.components ?? [])
      .filter((item) => relatedIds.has(item.id))
      .map(({ title, route }) => ({ title, route })),
    components: [...catalogue.manifest.entries, ...catalogue.removedComponents]
      .filter((item): item is ManifestComponent => item.kind === "component")
      .map(({ id, title, route }) => ({ id, title, route })),
    views: generatedViews(entry).map((view) => {
      if (!context.previewGeneration || removed) return view;
      const demand = { ...view };
      delete demand.usage;
      return demand;
    }),
    changedViews: changedViews(
      entry,
      context,
      comparison,
      variants[0]?.value.id,
    ),
    variants,
    usedBy: (catalogue.manifest.schemaVersion === "live-index-1"
      ? []
      : catalogue.manifest.entries
    )
      .filter((owner) => owner.kind !== "collection")
      .flatMap((owner) =>
        generatedViews(owner).flatMap((view) =>
          orderedInstances(view.usage)
            .filter((instance) => instance.componentId === entry.id)
            .map((instance) => ({
              title: owner.title,
              route: owner.route!,
              viewport: view.viewport,
              colorScheme: view.colorScheme,
              ...(view.variantId ? { variantId: view.variantId } : {}),
              instanceKey: instance.key,
              direct: instance.owner.kind === "entry",
              removed: false,
              comparisonEligible: false,
            })),
        ),
      ),
    affected: dedupeUsageLinks(affected),
    ...(status ? { status } : {}),
    ...(change ? { change } : {}),
    ...(comparison ? { comparison } : {}),
    ...(resourceEvidence ? { resourceEvidence } : {}),
  };
}
