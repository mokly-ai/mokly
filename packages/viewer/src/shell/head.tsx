// The heading for a catalogue view uses the title, path, and folder
// ancestors from the shared hierarchy or removed entry baseline.

import { viewHref } from "../navigation/routes.js";

import type { Catalogue } from "./catalogue.js";
import {
  branchPoints,
  type VariantParentResolution,
} from "./catalogue_branch_point.js";
import { structuredCrumbTrail, type CatalogueCrumb } from "./crumbs.js";
import type { RouteTarget } from "./target.js";
import { variantHeading } from "./view_title.js";

/**
 * The crumb for a variant's parent: an eligible current parent links to its
 * page, a removed parent to its retained snapshot, and a stored title is text.
 */
function parentCrumb(parent: VariantParentResolution): CatalogueCrumb {
  if (parent.source === "title") return { label: parent.title };
  const snapshot =
    parent.source === "removed" ? parent.record.snapshotId : undefined;
  return {
    href: `${viewHref(parent.entry.path)}${
      snapshot ? `?snapshot=${snapshot}` : ""
    }`,
    label: parent.entry.title,
  };
}

/**
 * The breadcrumb trail, path, and title for one resolved route target. A
 * component variant's heading is its parent's title, as on the parent's own
 * page, so its crumbs end at the folders; a screen variant's crumbs end in
 * its parent's title.
 */
export function targetHead(
  catalogue: Catalogue,
  target: RouteTarget,
): { crumbs: CatalogueCrumb[]; path: string; title: string } {
  const ancestors =
    catalogue.removedEntries
      .find(({ entry }) => entry.path === target.entry.path)
      ?.folderTitles.map((label) => ({ label })) ??
    structuredCrumbTrail(catalogue.hierarchy, target.entry.path);
  const heading = variantHeading(catalogue, target.entry);
  if (heading !== undefined)
    return { crumbs: ancestors, path: target.entry.path, title: heading };
  const parent = branchPoints(catalogue).parentOf(target.entry);
  return {
    crumbs: parent ? [...ancestors, parentCrumb(parent)] : ancestors,
    path: target.entry.path,
    title: target.entry.title,
  };
}
