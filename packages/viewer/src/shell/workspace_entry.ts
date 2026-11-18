/** Route-owned workspace entry and its component evidence parent. */

import type {
  ShellCatalogueComponent,
  ShellCatalogueVariant,
  ShellCatalogueScreen,
  ShellCatalogueRoutedEntry,
} from "../catalogue/scoped_types.js";
import { isComponentVariant } from "../catalogue/variants.js";

import type { Catalogue } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import type { WorkspaceData } from "./workspace_data.js";

/** A routed entry that renders through the shared workspace. */
export type WorkspaceEntry = Extract<
  ShellCatalogueRoutedEntry,
  { kind: "component" | "screen" }
>;
export type WorkspaceEvidenceEntry =
  ShellCatalogueComponent | ShellCatalogueVariant | ShellCatalogueScreen;

/** A variant's eligible current or removed parent entry, if the lookup has one. */
function parentEntry(
  catalogue: Catalogue,
  entry: ShellCatalogueRoutedEntry,
): ShellCatalogueRoutedEntry | undefined {
  const parent = branchPoints(catalogue).parentOf(entry);
  return parent && parent.source !== "title" ? parent.entry : undefined;
}

/**
 * The identity a routed workspace mounts under. A component variant shares
 * its resolved parent's workspace, so moving between siblings keeps the
 * workspace state; any other entry, and a variant without an eligible parent,
 * mounts under its own path.
 */
export function workspaceKey(
  catalogue: Catalogue,
  entry: ShellCatalogueRoutedEntry,
): string {
  if (entry.kind !== "component" || !isComponentVariant(entry))
    return entry.path;
  return parentEntry(catalogue, entry)?.path ?? entry.path;
}

/**
 * Parent component evidence, or the routed entry's own evidence identity: a
 * screen, or a variant without an eligible parent. A component parent always
 * has `data.component`.
 */
export function workspaceEvidenceEntry(
  data: WorkspaceData,
): WorkspaceEvidenceEntry {
  return data.component ?? data.entry;
}
