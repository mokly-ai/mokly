/** The text that names a shell view in the browser title and announcements. */

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import type { RouteTarget } from "./target.js";
import type { ShellView } from "./views.js";

/** A component variant's page is headed by its parent's title. */
export function variantHeading(
  catalogue: Catalogue,
  entry: RouteTarget["entry"],
): string | undefined {
  if (entry.kind !== "component") return undefined;
  const parent = branchPoints(catalogue).parentOf(entry);
  return parent && parent.source !== "title" ? parent.entry.title : undefined;
}

/**
 * The browser title of a shell view, which the route announcement repeats:
 * the shown entry's own title, then its heading when that differs, such as
 * "Disabled · Button · Mokly".
 */
export function viewTitle(catalogue: Catalogue, view: ShellView): string {
  const title = catalogue.publicModel.identity.title;
  if (view.kind === "home") return title;
  if (view.kind === "missing") return `Not found · ${title}`;
  const own = view.target.entry.title;
  const heading = variantHeading(catalogue, view.target.entry) ?? own;
  return heading === own
    ? `${own} · ${title}`
    : `${own} · ${heading} · ${title}`;
}
