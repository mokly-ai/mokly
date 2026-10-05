/** Titles of the folders at or above a catalogue path, used by search. */

import type { CatalogueHierarchy, HierarchyEntry } from "./hierarchy.js";

/** Look up the folder titles at or above one path, outermost first. */
export type FolderTitleLookup = (path: string) => readonly string[];

const titlesByHierarchy = new WeakMap<object, ReadonlyMap<string, string>>();

/**
 * Every folder's resolved title by path. A folder exists only while an entry
 * that is not a variant lies below it, so those entries' breadcrumbs name
 * every folder once.
 */
function folderTitles<T extends HierarchyEntry>(
  hierarchy: CatalogueHierarchy<T>,
): ReadonlyMap<string, string> {
  const cached = titlesByHierarchy.get(hierarchy);
  if (cached) return cached;
  const titles = new Map<string, string>();
  for (const [path, crumbs] of hierarchy.ancestorsByPath) {
    if (hierarchy.variantParentByPath.has(path)) continue;
    const segments = path.split("/").slice(0, -1);
    if (segments.length !== crumbs.length) continue;
    crumbs.forEach((title, index) =>
      titles.set(segments.slice(0, index + 1).join("/"), title),
    );
  }
  titlesByHierarchy.set(hierarchy, titles);
  return titles;
}

/**
 * The titles of the folders at or above a path, outermost first. A folder's
 * own page and the variants of a screen or component that is one are at or
 * below that folder, so they include its title.
 */
export function folderTitlesAt<T extends HierarchyEntry>(
  hierarchy: CatalogueHierarchy<T>,
  path: string,
): readonly string[] {
  const titles = folderTitles(hierarchy);
  const segments = path.split("/");
  return segments.flatMap((_, index) => {
    const title = titles.get(segments.slice(0, index + 1).join("/"));
    return title === undefined ? [] : [title];
  });
}

/** Bind {@link folderTitlesAt} to one hierarchy. */
export function folderTitleLookup<T extends HierarchyEntry>(
  hierarchy: CatalogueHierarchy<T>,
): FolderTitleLookup {
  return (path) => folderTitlesAt(hierarchy, path);
}
