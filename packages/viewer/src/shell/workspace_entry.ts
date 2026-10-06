/** Route-owned workspace entry and its component evidence parent. */

import { branchPoints } from "../catalogue/branch_point.js";
import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import {
  isManifestComponentVariant,
  type ManifestComponent,
  type ManifestComponentVariant,
} from "../components/manifest_types.js";
import type { ManifestScreen } from "../registry/types.js";
import type { ComponentReview } from "../review/component_types.js";

import type { Catalogue, CatalogueManifestEntry } from "./catalogue.js";
import type { WorkspaceData } from "./workspace_data.js";

/** A routed entry that renders through the shared workspace. */
export type WorkspaceEntry = Extract<
  CatalogueManifestEntry,
  { kind: "component" | "screen" }
>;
export type WorkspaceEvidenceEntry =
  | ManifestComponent<CurrentPath>
  | ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>
  | ManifestScreen<CurrentPath, CurrentPath | BranchPointPath>;

/** A variant's eligible current or removed parent entry, if the lookup has one. */
function parentEntry(
  catalogue: Catalogue,
  entry: CatalogueManifestEntry,
): CatalogueManifestEntry | undefined {
  const parent = branchPoints(catalogue).parentOf(entry);
  return parent && parent.source !== "title" ? parent.entry : undefined;
}

/**
 * Resolve the schema-owning component for a parent or variant route. A
 * variant reaches its parent through the branch-point lookup, so a moved or
 * case-renamed parent still owns its removed variants.
 */
export function workspaceComponent(
  catalogue: Catalogue,
  entry: WorkspaceEntry,
): ManifestComponent<CurrentPath> | undefined {
  if (entry.kind !== "component") return;
  const candidate = isManifestComponentVariant(entry)
    ? parentEntry(catalogue, entry)
    : entry;
  return candidate?.kind === "component" &&
    !isManifestComponentVariant(candidate)
    ? candidate
    : undefined;
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

/**
 * The component review a workspace reads: its resolved parent's group, or for
 * a variant without an eligible parent, the group that lists the variant.
 */
export function componentReview(
  components:
    readonly ComponentReview<CurrentPath, BranchPointPath>[] | undefined,
  component: ManifestComponent<CurrentPath> | undefined,
  entry: WorkspaceEntry,
): ComponentReview<CurrentPath, BranchPointPath> | undefined {
  if (component)
    return components?.find((item) => item.path === component.path);
  return entry.kind === "component" && isManifestComponentVariant(entry)
    ? components?.find((item) =>
        item.variants.some(({ path }) => path === entry.path),
      )
    : undefined;
}

/** Product title for a routed consumer, including its component parent. */
export function workspaceEntryTitle(
  catalogue: Catalogue,
  entry: CatalogueManifestEntry,
): string {
  if (entry.kind !== "component" || !isManifestComponentVariant(entry))
    return entry.title;
  const parent = parentEntry(catalogue, entry);
  return parent ? `${parent.title} · ${entry.title}` : entry.title;
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
