import type { CatalogueReadModel } from "../catalogue/types.js";
import { parseSearchQuery, rowMatchesQuery } from "../client/search_query.js";

import type { ViewerSelection } from "./types.js";

export const defaultSelection: ViewerSelection = {
  screenId: null,
  view: "all",
  viewport: "both",
  colorScheme: "light",
  search: "",
  tags: [],
};
/** Normalize without mutating either the caller's object or tag array. */
export function normalizeSelection(value: ViewerSelection): ViewerSelection {
  if (
    !value ||
    !Object.keys(value).every((key) => key in defaultSelection) ||
    !(value.screenId === null || typeof value.screenId === "string") ||
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
    ...value,
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
  return Object.keys(defaultSelection).every((key) =>
    key === "tags"
      ? a.tags.length === b.tags.length &&
        a.tags.every((tag, i) => tag === b.tags[i])
      : a[key as keyof ViewerSelection] === b[key as keyof ViewerSelection],
  );
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
