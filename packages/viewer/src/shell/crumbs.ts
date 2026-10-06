// Breadcrumb trails derived from the one path tree.

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import { viewHref } from "../navigation/routes.js";
import type { CatalogueHierarchy } from "../registry/hierarchy.js";
import type { ManifestEntry } from "../registry/types.js";

import { navNodeVisible, UNFILTERED_SELECTION } from "./nav_model.js";
import { folderRevealPath } from "./nav_reveal.js";
import type { NavSectionNode } from "./nav_tree.js";
import { buildNavSections } from "./nav_tree.js";

/** A folder row that a breadcrumb reveals in the navigation tree. */
export interface CrumbFolder {
  path: string;
  section: NavSectionNode["id"];
}

/**
 * One breadcrumb segment. A folder with its own page links to that page; a
 * folder without one reveals its row in the tree; anything else is text.
 */
export interface CatalogueCrumb {
  /** A viewable route this crumb links to. */
  href?: string;
  /** A folder without its own page that this crumb expands in the tree. */
  folder?: CrumbFolder;
  label: string;
}

/**
 * Derive the folder crumbs above a current entry. A variant's crumbs are its
 * parent's, because the variant is listed under that parent rather than in a
 * folder of its own. A folder without its own page stays text when All
 * without search has no row for it, including pruned or hidden ancestry.
 */
export function structuredCrumbTrail(
  hierarchy: CatalogueHierarchy<
    ManifestEntry<CurrentPath, CurrentPath | BranchPointPath>
  >,
  entryId: string,
): CatalogueCrumb[] {
  const titles = hierarchy.ancestorsByPath.get(entryId) ?? [];
  const owner = hierarchy.variantParentByPath.get(entryId)?.path ?? entryId;
  const segments = owner.split("/").slice(0, -1);
  if (segments.length !== titles.length)
    return titles.map((label) => ({ label }));
  const section =
    hierarchy.byPath.get(entryId)?.kind === "component"
      ? "components"
      : "specs";
  const sections = buildNavSections(hierarchy);
  return titles.map((label, index) => {
    const path = segments.slice(0, index + 1).join("/");
    if (hierarchy.byPath.has(path)) return { href: viewHref(path), label };
    const reveal = folderRevealPath(sections, section, path);
    if (!reveal || !navNodeVisible(reveal.node, UNFILTERED_SELECTION, {}))
      return { label };
    return { folder: { path, section }, label };
  });
}
