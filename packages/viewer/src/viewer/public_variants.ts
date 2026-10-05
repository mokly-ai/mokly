/** Public component records a workspace reaches through the branch-point lookup. */

import { branchPoints } from "../catalogue/branch_point.js";
import type { EntryResolution } from "../catalogue/branch_point_types.js";
import { currentCatalogueEntries } from "../catalogue/entry_selection.js";
import type {
  ShellCatalogueComponent,
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueVariant,
} from "../catalogue/scoped_types.js";
import type { Catalogue } from "../shell/catalogue.js";

/**
 * The public record a lookup result names: the current record at the same
 * identity, or the removed record retaining the same snapshot.
 */
function modelRecord(
  model: ShellCatalogueReadModel,
  resolution: EntryResolution,
): ShellCatalogueRoutedEntry | undefined {
  const { entry } = resolution;
  const same = (candidate: ShellCatalogueRoutedEntry) =>
    candidate.kind === entry.kind && candidate.path === entry.path;
  return resolution.source === "current"
    ? currentCatalogueEntries(model).find(same)
    : model.removedEntries.find(
        (record) =>
          same(record.entry) &&
          record.snapshotId === resolution.record.snapshotId,
      )?.entry;
}

function isParent(
  entry: ShellCatalogueRoutedEntry | undefined,
): entry is ShellCatalogueComponent {
  return entry?.kind === "component" && !("variantOf" in entry);
}

function isVariant(
  entry: ShellCatalogueRoutedEntry | undefined,
): entry is ShellCatalogueVariant {
  return entry?.kind === "component" && "variantOf" in entry;
}

/** A variant's eligible public parent record, resolved by the shared lookup. */
export function publicParent(
  catalogue: Catalogue,
  model: ShellCatalogueReadModel,
  entry: Pick<ShellCatalogueRoutedEntry, "kind" | "path">,
): ShellCatalogueComponent | undefined {
  const parent = branchPoints(catalogue).parentOf(entry);
  const record =
    parent && parent.source !== "title"
      ? modelRecord(model, parent)
      : undefined;
  return isParent(record) ? record : undefined;
}

/**
 * A public parent's variants: its current variants in catalogue order, then
 * the removed variants the lookup attaches to it, in record order.
 */
export function publicVariants(
  catalogue: Catalogue,
  model: ShellCatalogueReadModel,
  parent: ShellCatalogueComponent,
  parentRemoved: boolean,
): readonly ShellCatalogueVariant[] {
  const current = parentRemoved
    ? []
    : (catalogue.hierarchy.variantsByPath.get(parent.path) ?? []).map(
        (entry): EntryResolution => ({ source: "current", entry }),
      );
  const removed = branchPoints(catalogue)
    .removedVariants(parent)
    .map((record): EntryResolution => ({
      source: "removed",
      entry: record.entry,
      record,
    }));
  return [...current, ...removed].flatMap((resolution) => {
    const record = modelRecord(model, resolution);
    return isVariant(record) ? [record] : [];
  });
}
