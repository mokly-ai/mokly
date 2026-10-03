/** Exact current or historical entry resolution for public selection. */

import type { CatalogueRecord } from "./types.js";

interface CatalogueIdentity {
  path: string;
  kind: CatalogueRecord["kind"];
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

/** Component variants in current order followed by retained removed variants. */
export function catalogueComponentVariants<
  Entry extends CatalogueIdentity = CatalogueRecord,
>(
  model: CatalogueIndex<Entry>,
  componentId: string,
): readonly ComponentVariant<Entry>[] {
  return [
    ...model.components,
    ...model.removedEntries.map(({ entry }) => entry),
  ].filter(
    (entry): entry is ComponentVariant<Entry> =>
      entry.kind === "component" &&
      "variantOf" in entry &&
      entry.variantOf === componentId,
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
