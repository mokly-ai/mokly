import type { CatalogueReadModel, EntryDetailV4 } from "@mokly/model";

import { detailKey } from "../catalogue/detail_fences.js";
import { keepEqualJson, sameJsonValue } from "../catalogue/json_values.js";

/** Match records without changing their new order, keeping the array when possible. */
export function reuseByKey<T>(
  held: T[],
  received: T[],
  key: (item: T) => string,
  reuse: (held: T, received: T) => T,
): T[];
export function reuseByKey<T>(
  held: readonly T[],
  received: readonly T[],
  key: (item: T) => string,
  reuse: (held: T, received: T) => T,
): readonly T[];
export function reuseByKey<T>(
  held: readonly T[],
  received: readonly T[],
  key: (item: T) => string,
  reuse: (held: T, received: T) => T,
): readonly T[] {
  if (held === received) return held;
  let byKey: Map<string, T> | undefined;
  let retainsArray = held.length === received.length;
  const items = received.map((item, index) => {
    const identity = key(item);
    const atIndex = held[index];
    const known =
      atIndex !== undefined && key(atIndex) === identity
        ? atIndex
        : (byKey ??= new Map(held.map((item) => [key(item), item]))).get(
            identity,
          );
    const next = known === undefined ? item : reuse(known, item);
    retainsArray &&= next === held[index];
    return next;
  });
  return retainsArray ? held : items;
}

function entryPath(entry: { path: string }): string {
  return entry.path;
}

/** Preserve unchanged raw records within each list of a new index. */
export function reuseIndex(
  held: CatalogueReadModel,
  index: CatalogueReadModel,
): CatalogueReadModel {
  return {
    ...index,
    screens: reuseByKey(held.screens, index.screens, entryPath, keepEqualJson),
    pages: reuseByKey(held.pages, index.pages, entryPath, keepEqualJson),
    documents: reuseByKey(
      held.documents,
      index.documents,
      entryPath,
      keepEqualJson,
    ),
    useCases: reuseByKey(
      held.useCases,
      index.useCases,
      entryPath,
      keepEqualJson,
    ),
    components: reuseByKey(
      held.components,
      index.components,
      entryPath,
      keepEqualJson,
    ),
    removedEntries: reuseByKey(
      held.removedEntries,
      index.removedEntries,
      ({ entry, snapshotId }) =>
        detailKey({
          path: entry.path,
          ...(snapshotId === undefined ? {} : { snapshotId }),
        }),
      keepEqualJson,
    ),
    tree: keepEqualJson(held.tree, index.tree),
    ...(held.treeOrder && sameJsonValue(held.treeOrder, index.treeOrder)
      ? { treeOrder: held.treeOrder }
      : {}),
  };
}

/** An equal detail id binds all of the detail's content apart from revision. */
export function reuseDetail(
  held: EntryDetailV4 | undefined,
  detail: EntryDetailV4,
): EntryDetailV4 {
  if (!held) return detail;
  if (held.detailId === detail.detailId) {
    if (held.revision === detail.revision) return held;
    if (detail.revision !== undefined)
      return { ...held, revision: detail.revision };
    return detail;
  }
  const views = detail.views.map((view) => {
    const known = held.views.find(
      (candidate) =>
        candidate.viewport === view.viewport &&
        candidate.colorScheme === view.colorScheme,
    );
    if (!known || !sameJsonValue(known.usage, view.usage)) return view;
    return { ...view, usage: known.usage };
  });
  return { ...detail, views };
}
