/** Live routing metadata is deliberately not a publishable manifest. */
import type { ColorScheme } from "@mokly/viewer";
import type { Manifest, ManifestV5 } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { validateDependencyDeclarations } from "../components/dependency_validation.js";
import { MoklyError } from "../errors.js";

import { createManifest } from "./manifest.js";
import { validateManifestMetadata } from "./manifest_validation.js";

export interface CatalogueIndex {
  schemaVersion: "live-index-1";
  generatedBy: "mokly";
  sourceFiles: readonly string[];
  entries: ManifestV5["entries"];
}

export type CatalogueMetadata = Manifest | CatalogueIndex;

export function createCatalogueIndex(
  entries: readonly ResolvedRegistryEntry[],
  sourceFiles: readonly string[],
  schemes: readonly ColorScheme[],
): CatalogueIndex {
  return parseCatalogueIndex({
    ...createManifest(entries, sourceFiles, schemes),
    schemaVersion: "live-index-1",
  });
}

/** Reuse route/schema/source checks without inventing unrendered usage evidence. */
export function parseCatalogueIndex(value: unknown): CatalogueIndex {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== "live-index-1"
  )
    throw new MoklyError("manifest-invalid", "expected a live catalogue index");
  const metadata = validateManifestMetadata({
    ...value,
    schemaVersion: 5,
  }) as ManifestV5;
  for (const entry of metadata.entries) {
    validateDependencyDeclarations(entry);
    if (
      (entry.kind === "screen" && entry.componentViews !== undefined) ||
      (entry.kind === "component" &&
        entry.variants.some(
          (variant) =>
            !Array.isArray(variant.componentViews) ||
            variant.componentViews.length > 0,
        ))
    )
      throw new MoklyError(
        "manifest-invalid",
        "live index cannot contain rendered usage",
      );
  }
  return value as CatalogueIndex;
}
