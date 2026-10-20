import { generatedViews, orderedInstances } from "../components/views.js";

import type { Catalogue } from "./catalogue.js";
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

/** Project manifest instance evidence into direct component-usage links. */
export function usedByUsageLinks(
  catalogue: Catalogue,
  evidenceEntry: WorkspaceEvidenceEntry,
): UsageLink[] {
  if (catalogue.manifest.schemaVersion === "live-index-2") return [];
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
