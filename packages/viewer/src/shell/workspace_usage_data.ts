import { generatedViews, orderedInstances } from "../components/views.js";
import type { ReviewResultV5 } from "../review/component_types.js";

import type { Catalogue } from "./catalogue.js";
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

/** Project review evidence into navigable affected-consumer links. */
export function affectedUsageLinks(
  catalogue: Catalogue,
  result: ReviewResultV5 | undefined,
  componentId: string | undefined,
): UsageLink[] {
  const currentEntriesById = new Map(
    catalogue.manifest.entries.map((candidate) => [candidate.id, candidate]),
  );
  const links: UsageLink[] = (result?.affectedConsumers ?? [])
    .filter((item) => item.changedComponentId === componentId)
    .flatMap((item) =>
      item.evidence.map((evidence) => {
        const entryId =
          evidence.context.kind === "component"
            ? evidence.context.variantId
            : evidence.context.entry.id;
        const destination =
          currentEntriesById.get(entryId) ??
          catalogue.removedEntries.find(
            ({ entry: candidate }) => candidate.id === entryId,
          )?.entry;
        const current = currentEntriesById.get(entryId);
        const removed = current === undefined;
        return {
          entryId,
          entryKind: evidence.context.kind,
          title: destination
            ? workspaceEntryTitle(catalogue, destination)
            : evidence.context.entry.title,
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
        .filter((instance) => instance.componentId === evidenceEntry.id)
        .map((instance) => ({
          entryId: owner.id,
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
