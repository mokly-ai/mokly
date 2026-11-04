/** Stable, section-scoped identities for persisted navigation disclosures. */

import { isEntryPath } from "@mokly/model";

import type { NavSectionNode } from "./nav_tree.js";

/**
 * Derive a disclosure key from a folder group's `folder:` key without parsing
 * its labels.
 */
export function folderDisclosureKey(
  section: NavSectionNode["id"],
  groupKey: string,
): string {
  return `folder:${section}:${groupKey.slice("folder:".length)}`;
}

/** Accept only current, well-formed persistence identities. */
export function isDisclosureKey(value: string): boolean {
  if (value === "section:specs" || value === "section:components") return true;
  if (
    value.startsWith("variants:") &&
    isEntryPath(value.slice("variants:".length))
  )
    return true;
  for (const prefix of ["folder:specs:", "folder:components:"]) {
    if (value.startsWith(prefix)) {
      const pathKey = value.slice(prefix.length);
      return isEntryPath(pathKey);
    }
  }
  return false;
}
