import { generatedViews, orderedInstances } from "../components/views.js";
import type { ReviewResultV5 } from "../review/component_types.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import { dedupeUsageLinks } from "./usage_links.js";
import { shownComparisonEligible } from "./view_status.js";
import {
  workspaceEntryTitle,
  type WorkspaceEvidenceEntry,
} from "./workspace_entry.js";

/** One routed use of, or consumer affected by, a component. */
export interface UsageLink {
  entryId: string;
  entryKind: "component" | "screen";
  title: string;
  viewport: "mobile" | "desktop";
  colorScheme: "light" | "dark";
  instanceKey: string;
  direct: boolean;
  removed: boolean;
  comparisonEligible: boolean;
}

/**
 * Project review evidence into navigable affected-consumer links. Each
 * evidence keeps its side's original path, so it resolves on that side: a
 * before-side path reaches the moved or case-renamed current entry, else its
 * removed record. Evidence that resolves to nothing yields no link.
 */
export function affectedUsageLinks(
  catalogue: Catalogue,
  result: ReviewResultV5 | undefined,
  componentId: string | undefined,
): UsageLink[] {
  const lookup = branchPoints(catalogue);
  const links: UsageLink[] = (result?.affectedConsumers ?? [])
    .filter((item) => item.changedComponentId === componentId)
    .flatMap((item) =>
      item.evidence.flatMap((evidence) => {
        const destination = lookup.resolve({
          side: evidence.side,
          kind: evidence.context.kind,
          path:
            evidence.context.kind === "component"
              ? evidence.context.variantPath
              : evidence.context.entry.path,
        });
        if (!destination) return [];
        const removed = destination.source === "removed";
        return [
          {
            entryId: destination.entry.path,
            entryKind: evidence.context.kind,
            title: workspaceEntryTitle(catalogue, destination.entry),
            viewport: evidence.context.viewport,
            colorScheme: evidence.context.colorScheme,
            instanceKey: evidence.via.at(-1)!.instanceKey,
            direct: evidence.via.length === 1,
            removed,
            comparisonEligible: shownComparisonEligible(
              removed ? "Removed" : "Changed",
              evidence.context.kind,
            ),
          },
        ];
      }),
    );
  return dedupeUsageLinks(links);
}

/** Project manifest instance evidence into direct component-usage links. */
export function usedByUsageLinks(
  catalogue: Catalogue,
  evidenceEntry: WorkspaceEvidenceEntry,
): UsageLink[] {
  if (catalogue.manifest.schemaVersion === "live-index-1") return [];
  return catalogue.manifest.entries.flatMap((owner) => {
    if (owner.kind !== "screen" && owner.kind !== "component") return [];
    return generatedViews(owner).flatMap((view) =>
      orderedInstances(view.usage)
        .filter((instance) => instance.componentId === evidenceEntry.path)
        .map((instance) => ({
          entryId: owner.path,
          entryKind: owner.kind,
          title: workspaceEntryTitle(catalogue, owner),
          viewport: view.viewport,
          colorScheme: view.colorScheme,
          instanceKey: instance.key,
          direct: instance.owner.kind === "entry",
          removed: false,
          comparisonEligible: false,
        })),
    );
  });
}
