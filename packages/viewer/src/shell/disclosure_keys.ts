/** Stable, section-scoped identities for persisted navigation disclosures. */

import { validNavLabel } from "../registry/nav_paths.js";

import type { NavSectionNode } from "./nav_tree.js";

/** Derive a disclosure key from a folder group without parsing its labels. */
export function folderDisclosureKey(
  section: NavSectionNode["id"],
  groupKey: string,
): string {
  if (!groupKey.startsWith("folder:"))
    throw new Error(`expected a folder group key, got ${groupKey}`);
  return `folder:${section}:${groupKey.slice("folder:".length)}`;
}

/** Accept only current, well-formed persistence identities. */
export function isDisclosureKey(value: string): boolean {
  if (value === "section:pages" || value === "section:components") return true;
  if (/^variants:(?:pages|components):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    return true;
  for (const prefix of ["folder:pages:", "folder:components:"]) {
    if (value.startsWith(prefix)) {
      const pathKey = value.slice(prefix.length);
      return pathKey.length > 0 && pathKey.split("/").every(validNavLabel);
    }
  }
  return false;
}
