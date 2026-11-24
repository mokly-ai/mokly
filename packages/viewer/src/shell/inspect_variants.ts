/**
 * The rows of Inspect's Variants list: the entry itself first, then its
 * saved variants. A screen's variant is a link that opens it, and the shown
 * one is checked. A variant set's row is a choice that selects the row's
 * Light frame, and the row of the frame that holds the selection is
 * checked; a removed row has no frame, so it links to its previous version.
 */

import type { InspectVariant } from "@mokly/ui/inspect-panel";

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";
import { viewHref } from "../navigation/routes.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import type { WorkspaceVariant } from "./workspace_data.js";

/** The address of an entry, with the snapshot of a removed one. */
function entryHref(
  catalogue: Catalogue,
  entry: ShellCatalogueRoutedEntry,
): string {
  const snapshot = catalogue.removedEntries.find(
    ({ entry: candidate }) => candidate.path === entry.path,
  )?.snapshotId;
  return `${viewHref(entry.path)}${snapshot ? `?snapshot=${snapshot}` : ""}`;
}

/**
 * A screen's rows: the screen that its variants belong to, then each current
 * variant, then each removed variant that the branch-point lookup attaches
 * to it, as a variant set lists its removed rows.
 */
export function screenVariants(
  catalogue: Catalogue,
  entry: ShellCatalogueRoutedEntry,
): InspectVariant[] {
  const lookup = branchPoints(catalogue);
  const parent = lookup.parentOf(entry);
  const owner = parent && parent.source !== "title" ? parent.entry : entry;
  const removed = catalogue.removedEntries.some(
    ({ entry: candidate }) => candidate.path === owner.path,
  );
  const current = removed
    ? []
    : (catalogue.hierarchy.variantsByPath.get(owner.path) ?? []);
  const variants = [
    ...current,
    ...lookup.removedVariants(owner).map(({ entry: variant }) => variant),
  ];
  return [owner, ...variants].map((row) => ({
    current: row.path === entry.path,
    href: entryHref(catalogue, row),
    key: row.path,
    label: row.title,
    path: row.path,
  }));
}

/** A variant set's rows: the component's own example, then each variant. */
export function setVariants(
  catalogue: Catalogue,
  rows: readonly WorkspaceVariant[],
  chosen: string | undefined,
  choose: (path: string) => void,
): InspectVariant[] {
  return rows.map(({ removed, value }) => ({
    current: value.path === chosen,
    ...(removed
      ? { href: entryHref(catalogue, value) }
      : { onChoose: () => choose(value.path) }),
    key: value.path,
    label: value.title,
    path: value.path,
  }));
}
