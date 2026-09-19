import type { CatalogueReadModel } from "../catalogue/types.js";
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
  "variantId",
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
  const entry = routedEntries(model).find(
    (candidate) => candidate.id === value?.screenId,
  );
  if (
    !value ||
    !Object.keys(value).every((key) => selectionKeys.has(key)) ||
    !(value.screenId === null || typeof value.screenId === "string") ||
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
  model: CatalogueReadModel,
  current: ViewerSelection,
  partial: Partial<ViewerSelection>,
): ViewerSelection {
  const candidate: ViewerSelection = { ...current, ...partial };
  if (
    partial.screenId !== undefined &&
    partial.screenId !== current.screenId &&
    !Object.hasOwn(partial, "variantId")
  )
    delete candidate.variantId;
  const next = normalizeSelection(model, candidate);
  return partial.screenId === undefined ? next : revealSelection(model, next);
}
export function selectionQuery(value: ViewerSelection): string {
  return [value.search, ...value.tags.map((tag) => `tag:${tag}`)]
    .filter(Boolean)
    .join(" ");
}
export function routedEntries(model: CatalogueReadModel) {
  return [
    ...model.screens,
    ...model.pages,
    ...model.useCases,
    ...model.components,
    ...model.removedEntries.map(({ entry }) => entry),
  ];
}
/** Route activation clears only constraints hiding its actual destination. */
export function revealSelection(
  model: CatalogueReadModel,
  value: ViewerSelection,
): ViewerSelection {
  const entry = routedEntries(model).find(
    (entry) => entry.id === value.screenId,
  );
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
