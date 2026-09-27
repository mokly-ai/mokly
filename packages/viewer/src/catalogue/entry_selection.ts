/** Exact current or historical entry resolution for public selection. */

import type {
  CatalogueComponentVariant,
  CatalogueReadModel,
  CatalogueRecord,
} from "./types.js";

export interface ResolvedCatalogueEntry {
  entry: CatalogueRecord;
  snapshotId?: string;
}

/** Current routed entries in public model order. */
export function currentCatalogueEntries(
  model: CatalogueReadModel,
): readonly CatalogueRecord[] {
  return [
    ...model.screens,
    ...model.pages,
    ...model.useCases,
    ...model.components,
  ];
}

/** Component variants in current order followed by retained removed variants. */
export function catalogueComponentVariants(
  model: CatalogueReadModel,
  componentId: string,
): readonly CatalogueComponentVariant[] {
  return [
    ...model.components,
    ...model.removedEntries.map(({ entry }) => entry),
  ].filter(
    (entry): entry is CatalogueComponentVariant =>
      entry.kind === "component" &&
      "variantOf" in entry &&
      entry.variantOf === componentId,
  );
}

/** Resolve the complete public selection; explicit snapshots never downgrade. */
export function resolveCatalogueSelection(
  model: CatalogueReadModel,
  entryId: string,
  snapshotId?: string,
): ResolvedCatalogueEntry | undefined {
  if (snapshotId !== undefined) {
    const historical = model.removedEntries.find(
      (record) =>
        record.entry.id === entryId && record.snapshotId === snapshotId,
    );
    return historical ? { entry: historical.entry, snapshotId } : undefined;
  }
  const current = currentCatalogueEntries(model).find(
    (entry) => entry.id === entryId,
  );
  if (current) return { entry: current };
  const historical = model.removedEntries.filter(
    (record) => record.entry.id === entryId,
  );
  if (historical.length !== 1) return undefined;
  const [record] = historical;
  return record
    ? {
        entry: record.entry,
        ...(record.snapshotId ? { snapshotId: record.snapshotId } : {}),
      }
    : undefined;
}

/** Resolve one kind-and-id address, inferring its published snapshot when unique. */
export function resolveCatalogueRoute(
  model: CatalogueReadModel,
  identity: { id: string; kind: CatalogueRecord["kind"] },
  snapshotId?: string,
): ResolvedCatalogueEntry | undefined {
  if (snapshotId !== undefined) {
    const historical = model.removedEntries.find(
      (record) =>
        record.entry.id === identity.id &&
        record.entry.kind === identity.kind &&
        record.snapshotId === snapshotId,
    );
    return historical ? { entry: historical.entry, snapshotId } : undefined;
  }
  const current = currentCatalogueEntries(model).find(
    (entry) => entry.id === identity.id && entry.kind === identity.kind,
  );
  if (current) return { entry: current };
  const historical = model.removedEntries.filter(
    (record) =>
      record.entry.id === identity.id && record.entry.kind === identity.kind,
  );
  if (historical.length !== 1) return undefined;
  const [record] = historical;
  if (!record) return undefined;
  if (record.snapshotId)
    return { entry: record.entry, snapshotId: record.snapshotId };
  return { entry: record.entry };
}

/** Resolve the public record corresponding to an already exact routed entry. */
export function resolveCatalogueRecord(
  model: CatalogueReadModel,
  entry: { id: string; kind: string },
): ResolvedCatalogueEntry | undefined {
  const current = currentCatalogueEntries(model).find(
    (candidate) => candidate.id === entry.id && candidate.kind === entry.kind,
  );
  if (current) return { entry: current };
  const historical = model.removedEntries.find(
    (record) =>
      record.entry.id === entry.id && record.entry.kind === entry.kind,
  );
  return historical
    ? {
        entry: historical.entry,
        ...(historical.snapshotId ? { snapshotId: historical.snapshotId } : {}),
      }
    : undefined;
}
