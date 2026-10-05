/** Exact current or historical entry resolution for public selection. */

import { branchPoints } from "./branch_point.js";
import type { CatalogueRecord } from "./types.js";

interface CatalogueIdentity {
  path: string;
  kind: CatalogueRecord["kind"];
  /** The branch-point path of a current entry the move contract paired. */
  previousPath?: string;
}

interface CatalogueIndex<Entry extends CatalogueIdentity> {
  screens: readonly Entry[];
  pages: readonly Entry[];
  documents: readonly Entry[];
  useCases: readonly Entry[];
  components: readonly Entry[];
  removedEntries: readonly { entry: Entry; snapshotId?: string }[];
}

type ComponentVariant<Entry extends CatalogueIdentity> = Extract<
  Entry,
  { kind: "component"; variantOf: string }
>;

export interface ResolvedCatalogueEntry<
  Entry extends CatalogueIdentity = CatalogueRecord,
> {
  entry: Entry;
  snapshotId?: string;
}

/** Current routed entries in public model order. */
export function currentCatalogueEntries<Entry extends CatalogueIdentity>(
  model: CatalogueIndex<Entry>,
): readonly Entry[] {
  return [
    ...model.screens,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.components,
  ];
}

/**
 * Component variants in current order followed by retained removed variants.
 * A variant resolves its parent on its own side, or collects only itself.
 */
export function catalogueComponentVariants<
  Entry extends CatalogueIdentity = CatalogueRecord,
>(
  model: CatalogueIndex<Entry>,
  componentId: string,
): readonly ComponentVariant<Entry>[] {
  const lookup = branchPoints(model);
  const selected = lookup.resolve({
    kind: "component",
    path: componentId,
    side: "before",
  });
  if (!selected) return [];
  const owner = lookup.parent(selected) ?? selected;
  if (owner.source === "title")
    return isVariant(selected.entry) ? [selected.entry] : [];
  if (isVariant(owner.entry)) return [owner.entry];
  const current =
    owner.source === "current"
      ? model.components.filter((entry) => {
          if (!isVariant(entry)) return false;
          const parent = lookup.parent({ source: "current", entry });
          return parent?.source === "current" && parent.entry === owner.entry;
        })
      : [];
  return [
    ...current,
    ...lookup.removedVariants(owner.entry).map(({ entry }) => entry),
  ].filter(isVariant);
}

function isVariant<Entry extends CatalogueIdentity>(
  entry: Entry,
): entry is ComponentVariant<Entry> {
  return (
    entry.kind === "component" &&
    "variantOf" in entry &&
    typeof entry.variantOf === "string"
  );
}

/** Resolve the complete public selection; explicit snapshots never downgrade. */
export function resolveCatalogueSelection<Entry extends CatalogueIdentity>(
  model: CatalogueIndex<Entry>,
  entryId: string,
  snapshotId?: string,
): ResolvedCatalogueEntry<Entry> | undefined {
  if (snapshotId !== undefined) {
    const historical = model.removedEntries.find(
      (record) =>
        record.entry.path === entryId && record.snapshotId === snapshotId,
    );
    return historical ? { entry: historical.entry, snapshotId } : undefined;
  }
  const current = currentCatalogueEntries(model).find(
    (entry) => entry.path === entryId,
  );
  if (current) return { entry: current };
  const historical = model.removedEntries.filter(
    (record) => record.entry.path === entryId,
  );
  if (historical.length !== 1) return undefined;
  const [record] = historical;
  if (!record) return undefined;
  return {
    entry: record.entry,
    ...(record.snapshotId ? { snapshotId: record.snapshotId } : {}),
  };
}

/** Resolve one path address with a kind constraint, inferring its published snapshot when unique. */
export function resolveCatalogueEntry<Entry extends CatalogueIdentity>(
  model: CatalogueIndex<Entry>,
  identity: { path: string; kind: Entry["kind"] },
  snapshotId?: string,
): ResolvedCatalogueEntry<Entry> | undefined {
  const selected = resolveCatalogueSelection(model, identity.path, snapshotId);
  return selected?.entry.kind === identity.kind ? selected : undefined;
}
