/** Route-owned workspace entry and its component evidence parent. */

import {
  isManifestComponentVariant,
  type ManifestComponent,
  type ManifestComponentVariant,
} from "../components/manifest_types.js";
import type { ManifestScreen } from "../registry/types.js";

import {
  catalogueVariantParent,
  type Catalogue,
  type CatalogueManifestEntry,
} from "./catalogue.js";
import type { WorkspaceData } from "./workspace_data.js";

/** A routed entry that renders through the shared workspace. */
export type WorkspaceEntry = Extract<
  CatalogueManifestEntry,
  { kind: "component" | "screen" }
>;
export type WorkspaceEvidenceEntry =
  ManifestComponent | ManifestComponentVariant | ManifestScreen;

/** Resolve the schema-owning component for a parent or variant route. */
export function workspaceComponent(
  catalogue: Catalogue,
  entry: WorkspaceEntry,
): ManifestComponent | undefined {
  if (entry.kind !== "component") return;
  const candidate = isManifestComponentVariant(entry)
    ? catalogue.byPath.get(entry.variantOf)
    : entry;
  return candidate?.kind === "component" &&
    !isManifestComponentVariant(candidate)
    ? candidate
    : undefined;
}

/** Product title for a routed consumer, including its component parent. */
export function workspaceEntryTitle(
  catalogue: Catalogue,
  entry: CatalogueManifestEntry,
): string {
  if (entry.kind !== "component" || !isManifestComponentVariant(entry))
    return entry.title;
  const parent = catalogueVariantParent(catalogue, entry);
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
