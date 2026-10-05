/** Component usage destinations for the embedded inspector. */

import { branchPoints } from "../catalogue/branch_point.js";
import type { EntryIdentity } from "../catalogue/branch_point_types.js";
import type {
  ShellCatalogueReadModel,
  AnyShellCatalogueEntry,
} from "../catalogue/scoped_types.js";
import { catalogueHasOmittedUsage } from "../catalogue/usage_scope.js";
import { generatedViews } from "../components/views.js";
import type { Catalogue } from "../shell/catalogue.js";
import type { UsageLink } from "../shell/workspace_usage_data.js";

import { displayEntry } from "./projection.js";
import { publicParent } from "./public_variants.js";
import { routedEntries } from "./selection.js";

/** Match each owner's unchanged usage names on that record's explicit side. */
export function publicUsageLinks(
  catalogue: Catalogue,
  model: ShellCatalogueReadModel,
  component: EntryIdentity<string>,
): UsageLink[] {
  if (catalogueHasOmittedUsage(model)) return [];
  const lookup = branchPoints(catalogue);
  const historical = new Set<AnyShellCatalogueEntry>(
    model.removedEntries.map(({ entry }) => entry),
  );
  const links: UsageLink[] = [];
  for (const owner of routedEntries(model)) {
    if (owner.kind !== "screen" && owner.kind !== "component") continue;
    const removed = historical.has(owner);
    for (const view of generatedViews(displayEntry(owner)))
      for (const instance of view.usage?.instances ?? []) {
        const destination = lookup.usageComponent(
          instance.componentId,
          removed ? "before" : "after",
        );
        if (
          destination?.entry.kind !== component.kind ||
          destination.entry.path !== component.path
        )
          continue;
        links.push({
          entryId: owner.path,
          entryKind: owner.kind,
          title: publicEntryTitle(catalogue, model, owner),
          viewport: view.viewport,
          colorScheme: view.colorScheme,
          instanceKey: instance.key,
          direct: instance.owner.kind === "entry",
          removed,
          comparisonEligible: false,
        });
      }
  }
  return links;
}

function publicEntryTitle(
  catalogue: Catalogue,
  model: ShellCatalogueReadModel,
  entry: Extract<AnyShellCatalogueEntry, { kind: "component" | "screen" }>,
): string {
  if (entry.kind !== "component" || !("variantOf" in entry)) return entry.title;
  const parent = publicParent(catalogue, model, entry);
  return parent ? `${parent.title} · ${entry.title}` : entry.title;
}
