/** Live routing metadata is deliberately not a publishable manifest. */
import type { ColorScheme } from "@mokly/viewer";
import {
  isManifestComponentVariant,
  type ManifestV9,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { MoklyError } from "../errors.js";

import type { FolderRecord } from "./folder_records.js";
import { createManifest } from "./manifest.js";
import { validateManifestMetadata } from "./manifest_validation.js";

export interface CatalogueIndex {
  schemaVersion: "live-index-2";
  generatedBy: "mokly";
  sourceFiles: readonly string[];
  entries: ManifestV9["entries"];
  folders: ManifestV9["folders"];
}

export type CatalogueMetadata = ManifestV9 | CatalogueIndex;

export function createCatalogueIndex(
  entries: readonly ResolvedRegistryEntry[],
  sourceFiles: readonly string[],
  schemes: readonly ColorScheme[],
  folders: readonly FolderRecord[] = [],
): CatalogueIndex {
  return parseCatalogueIndex({
    ...createManifest(entries, sourceFiles, schemes, new Map(), folders),
    schemaVersion: "live-index-2",
  });
}

/** Reuse route/schema/source checks without inventing unrendered usage evidence. */
export function parseCatalogueIndex(value: unknown): CatalogueIndex {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== "live-index-2"
  )
    throw new MoklyError("manifest-invalid", "expected a live catalogue index");
  const metadata = validateManifestMetadata({
    ...value,
    schemaVersion: 9,
  });
  for (const entry of metadata.entries) {
    if (
      (entry.kind === "screen" && entry.componentViews !== undefined) ||
      (entry.kind === "component" &&
        isManifestComponentVariant(entry) &&
        (!Array.isArray(entry.componentViews) ||
          entry.componentViews.length > 0))
    )
      throw new MoklyError(
        "manifest-invalid",
        "live index cannot contain rendered usage",
      );
  }
  return value as CatalogueIndex;
}
