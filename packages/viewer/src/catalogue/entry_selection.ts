/** Exact current or historical entry resolution for public selection. */

import type { CatalogueReadModel, CatalogueRoutedEntry } from "./types.js";

interface CatalogueRouteEntry {
  id: string;
  kind: CatalogueRoutedEntry["kind"];
  route: string;
}

interface CatalogueRouteIndex<Entry extends CatalogueRouteEntry> {
  screens: readonly Entry[];
  pages: readonly Entry[];
  useCases: readonly Entry[];
  components: readonly Entry[];
  removedEntries: readonly { entry: Entry; snapshotId?: string }[];
}

export interface ResolvedCatalogueEntry<
  Entry extends CatalogueRouteEntry = CatalogueRoutedEntry,
> {
  entry: Entry;
  snapshotId?: string;
}

/** Current routed entries in public model order. */
export function currentCatalogueEntries<Entry extends CatalogueRouteEntry>(
  model: CatalogueRouteIndex<Entry>,
): readonly Entry[] {
  return [
    ...model.screens,
    ...model.pages,
    ...model.useCases,
    ...model.components,
  ];
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

/** Resolve one route, inferring a published snapshot only from that exact route. */
export function resolveCatalogueRoute<Entry extends CatalogueRouteEntry>(
  model: CatalogueRouteIndex<Entry>,
  route: string,
  snapshotId?: string,
): ResolvedCatalogueEntry<Entry> | undefined {
  const current = currentCatalogueEntries(model).find(
    (entry) => entry.route === route,
  );
  if (current) return snapshotId === undefined ? { entry: current } : undefined;
  const historical = model.removedEntries.filter(
    (record) => record.entry.route === route,
  );
  if (historical.length !== 1) return undefined;
  const [record] = historical;
  if (!record) return undefined;
  if (snapshotId !== undefined)
    return record.snapshotId === snapshotId
      ? { entry: record.entry, snapshotId }
      : undefined;
  if (record.snapshotId)
    return { entry: record.entry, snapshotId: record.snapshotId };
  const collides = currentCatalogueEntries(model).some(
    (entry) => entry.id === record.entry.id,
  );
  return collides ? undefined : { entry: record.entry };
}

/** Resolve the public record corresponding to an already exact routed entry. */
export function resolveCatalogueRecord<Entry extends CatalogueRouteEntry>(
  model: CatalogueRouteIndex<Entry>,
  entry: { id: string; kind: string; route: string },
): ResolvedCatalogueEntry<Entry> | undefined {
  const current = currentCatalogueEntries(model).find(
    (candidate) =>
      candidate.id === entry.id &&
      candidate.kind === entry.kind &&
      candidate.route === entry.route,
  );
  if (current) return { entry: current };
  const historical = model.removedEntries.find(
    (record) =>
      record.entry.id === entry.id &&
      record.entry.kind === entry.kind &&
      record.entry.route === entry.route,
  );
  return historical
    ? {
        entry: historical.entry,
        ...(historical.snapshotId ? { snapshotId: historical.snapshotId } : {}),
      }
    : undefined;
}
