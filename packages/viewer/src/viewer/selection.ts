import {
  currentCatalogueEntries,
  resolveCatalogueSelection,
} from "../catalogue/entry_selection.js";
import type { ShellCatalogueReadModel } from "../catalogue/scoped_types.js";
import { isHistoricalSnapshotId } from "../catalogue/snapshot_identity.js";
import { parseSearchQuery, rowMatchesQuery } from "../shell/search_query.js";

import type { ViewerSelection } from "./types.js";

export const defaultSelection: ViewerSelection = {
  screenId: null,
  view: "all",
  viewport: "both",
  colorScheme: "light",
  search: "",
  tags: [],
};
const selectionKeys = new Set([
  "screenId",
  "snapshotId",
  "variantId",
  "view",
  "viewport",
  "colorScheme",
  "search",
  "tags",
]);
/** Normalize without mutating either the caller's object or tag array. */
export function normalizeSelection(
  model: ShellCatalogueReadModel,
  value: ViewerSelection,
): ViewerSelection {
  const resolved =
    typeof value?.screenId === "string"
      ? resolveCatalogueSelection(model, value.screenId, value.snapshotId)
      : undefined;
  const entry = resolved?.entry;
  if (
    !value ||
    !Object.keys(value).every((key) => selectionKeys.has(key)) ||
    !(value.screenId === null || typeof value.screenId === "string") ||
    !(
      value.snapshotId === undefined ||
      (isHistoricalSnapshotId(value.snapshotId) && value.screenId !== null)
    ) ||
    (value.snapshotId !== undefined && entry === undefined) ||
    !(
      value.variantId === undefined ||
      (typeof value.variantId === "string" &&
        entry?.kind === "component" &&
        entry.variants.some((variant) => variant.id === value.variantId))
    ) ||
    !["all", "changes"].includes(value.view) ||
    !["mobile", "desktop", "both"].includes(value.viewport) ||
    !["light", "dark"].includes(value.colorScheme) ||
    typeof value.search !== "string" ||
    !Array.isArray(value.tags) ||
    !value.tags.every(
      (tag: unknown) =>
        typeof tag === "string" && tag.trim() && !/\s/.test(tag.trim()),
    )
  )
    throw new Error("The requested catalogue selection is unavailable.");
  const query = parseSearchQuery(value.search);
  return {
    screenId: value.screenId,
    ...(resolved?.snapshotId ? { snapshotId: resolved.snapshotId } : {}),
    ...(value.variantId === undefined ? {} : { variantId: value.variantId }),
    view: value.view,
    viewport: value.viewport,
    colorScheme: value.colorScheme,
    search: query.freeText,
    tags: [
      ...new Set([
        ...value.tags.map((tag) => tag.trim().toLowerCase()),
        ...query.tags,
      ]),
    ],
  };
}
export function sameSelection(a: ViewerSelection, b: ViewerSelection): boolean {
  return (
    a.screenId === b.screenId &&
    a.snapshotId === b.snapshotId &&
    a.variantId === b.variantId &&
    a.view === b.view &&
    a.viewport === b.viewport &&
    a.colorScheme === b.colorScheme &&
    a.search === b.search &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  );
}
/** Merge one public proposal and reset a saved variant on entry changes. */
export function mergeSelection(
  model: ShellCatalogueReadModel,
  current: ViewerSelection,
  partial: Partial<ViewerSelection>,
): ViewerSelection {
  const candidate: ViewerSelection = { ...current, ...partial };
  const screenSupplied = Object.hasOwn(partial, "screenId");
  const snapshotSupplied = Object.hasOwn(partial, "snapshotId");
  if (
    (screenSupplied && !snapshotSupplied) ||
    (snapshotSupplied && partial.snapshotId === undefined)
  )
    delete candidate.snapshotId;
  if (
    (candidate.screenId !== current.screenId ||
      candidate.snapshotId !== current.snapshotId) &&
    !Object.hasOwn(partial, "variantId")
  )
    delete candidate.variantId;
  const next = normalizeSelection(model, candidate);
  return screenSupplied || snapshotSupplied
    ? revealSelection(model, next)
    : next;
}
export function selectionQuery(value: ViewerSelection): string {
  return [value.search, ...value.tags.map((tag) => `tag:${tag}`)]
    .filter(Boolean)
    .join(" ");
}
export function routedEntries(model: ShellCatalogueReadModel) {
  return [
    ...currentCatalogueEntries(model),
    ...model.removedEntries.map(({ entry }) => entry),
  ];
}
/** Route activation clears only constraints hiding its actual destination. */
export function revealSelection(
  model: ShellCatalogueReadModel,
  value: ViewerSelection,
): ViewerSelection {
  const entry =
    typeof value.screenId === "string"
      ? resolveCatalogueSelection(model, value.screenId, value.snapshotId)
          ?.entry
      : undefined;
  if (!entry) return value;
  const matches = rowMatchesQuery(
    { freeText: value.search, tags: value.tags },
    { id: entry.id, route: entry.route, tags: entry.tags, text: entry.title },
  );
  return {
    ...value,
    ...(matches ? {} : { search: "", tags: [] }),
    ...(value.view === "changes" &&
    !(entry.changes.status === "ready" && entry.changes.included)
      ? { view: "all" as const }
      : {}),
  };
}
