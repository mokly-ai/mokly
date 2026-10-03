import {
  currentCatalogueEntries,
  resolveCatalogueSelection,
} from "../catalogue/entry_selection.js";
import { isHistoricalSnapshotId } from "../catalogue/snapshot_identity.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import { parseSearchQuery, rowMatchesQuery } from "../shell/search_query.js";

import type { ViewerSelection } from "./types.js";

export const defaultSelection: ViewerSelection = {
  screenPath: null,
  view: "all",
  viewport: "both",
  colorScheme: "light",
  search: "",
  tags: [],
};
const selectionKeys = new Set([
  "screenPath",
  "snapshotId",
  "view",
  "viewport",
  "colorScheme",
  "search",
  "tags",
]);
/** Normalize without mutating either the caller's object or tag array. */
export function normalizeSelection(
  model: CatalogueReadModel,
  value: ViewerSelection,
): ViewerSelection {
  const resolved =
    typeof value?.screenPath === "string"
      ? resolveCatalogueSelection(model, value.screenPath, value.snapshotId)
      : undefined;
  const entry = resolved?.entry;
  if (
    !value ||
    !Object.keys(value).every((key) => selectionKeys.has(key)) ||
    !(value.screenPath === null || typeof value.screenPath === "string") ||
    !(
      value.snapshotId === undefined ||
      (isHistoricalSnapshotId(value.snapshotId) && value.screenPath !== null)
    ) ||
    (value.snapshotId !== undefined && entry === undefined) ||
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
    screenPath: value.screenPath,
    ...(resolved?.snapshotId ? { snapshotId: resolved.snapshotId } : {}),
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
    a.screenPath === b.screenPath &&
    a.snapshotId === b.snapshotId &&
    a.view === b.view &&
    a.viewport === b.viewport &&
    a.colorScheme === b.colorScheme &&
    a.search === b.search &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  );
}
/** Merge one public proposal and normalize route-owned entry identity. */
export function mergeSelection(
  model: CatalogueReadModel,
  current: ViewerSelection,
  partial: Partial<ViewerSelection>,
): ViewerSelection {
  const candidate: ViewerSelection = { ...current, ...partial };
  const screenSupplied = Object.hasOwn(partial, "screenPath");
  const snapshotSupplied = Object.hasOwn(partial, "snapshotId");
  if (
    (screenSupplied && !snapshotSupplied) ||
    (snapshotSupplied && partial.snapshotId === undefined)
  )
    delete candidate.snapshotId;
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
export function routedEntries(model: CatalogueReadModel) {
  return [
    ...currentCatalogueEntries(model),
    ...model.removedEntries.map(({ entry }) => entry),
  ];
}
/** Route activation clears only constraints hiding its actual destination. */
export function revealSelection(
  model: CatalogueReadModel,
  value: ViewerSelection,
): ViewerSelection {
  const entry =
    typeof value.screenPath === "string"
      ? resolveCatalogueSelection(model, value.screenPath, value.snapshotId)
          ?.entry
      : undefined;
  if (!entry) return value;
  const matches = rowMatchesQuery(
    { freeText: value.search, tags: value.tags },
    {
      id: entry.path,
      tags: entry.tags,
      text: entry.title,
    },
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
