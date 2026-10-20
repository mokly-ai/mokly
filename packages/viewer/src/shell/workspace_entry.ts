/** Route-owned workspace entry and its component evidence parent. */

import {
  isManifestComponentVariant,
  type ManifestComponent,
  type ManifestComponentVariant,
} from "../components/manifest_types.js";
import type { ManifestScreen } from "../registry/types.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import { branchPoints } from "./catalogue_branch_point.js";
import type { WorkspaceData } from "./workspace_data.js";

/** A routed entry that renders through the shared workspace. */
export type WorkspaceEntry = Extract<
  CatalogueManifestEntry,
  { kind: "component" | "screen" }
>;
export type WorkspaceEvidenceEntry =
  ManifestComponent | ManifestComponentVariant | ManifestScreen;

/** A variant's eligible current or removed parent entry, if the lookup has one. */
function parentEntry(
  catalogue: Catalogue,
  entry: CatalogueManifestEntry,
): CatalogueManifestEntry | undefined {
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
  entry: CatalogueManifestEntry,
): string {
  if (entry.kind !== "component" || !isManifestComponentVariant(entry))
    return entry.path;
  return parentEntry(catalogue, entry)?.path ?? entry.path;
}

/** Parent component evidence or the routed screen's own evidence identity. */
export function workspaceEvidenceEntry(
  data: WorkspaceData,
): WorkspaceEvidenceEntry {
  if (data.component) return data.component;
  if (
    data.entry.kind === "screen" ||
    (data.entry.kind === "component" && isManifestComponentVariant(data.entry))
  )
    return data.entry;
  throw new Error("The workspace evidence entry is unavailable.");
}
