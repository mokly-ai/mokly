/** Live routing metadata is deliberately not a publishable manifest. */
import type { ColorScheme } from "@mokly/viewer";
import {
  isManifestComponentVariant,
  type ManifestV7,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { validateDependencyDeclarations } from "../components/dependency_validation.js";
import { MoklyError } from "../errors.js";

import { createManifest } from "./manifest.js";
import { validateManifestMetadata } from "./manifest_validation.js";

/** One private live-index entry with resolved Live-preview eligibility. */
export type CatalogueIndexEntry =
  | (Extract<
      ManifestV7["entries"][number],
      { kind: "component" | "screen" }
    > & { interactive: boolean })
  | Exclude<ManifestV7["entries"][number], { kind: "component" | "screen" }>;

export interface CatalogueIndex {
  schemaVersion: "live-index-1";
  generatedBy: "mokly";
  sourceFiles: readonly string[];
  entries: readonly CatalogueIndexEntry[];
}

export type CatalogueMetadata = ManifestV7 | CatalogueIndex;

export function createCatalogueIndex(
  entries: readonly ResolvedRegistryEntry[],
  sourceFiles: readonly string[],
  schemes: readonly ColorScheme[],
): CatalogueIndex {
  const manifest = createManifest(entries, sourceFiles, schemes);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return parseCatalogueIndex({
    ...manifest,
    entries: manifest.entries.map((entry) =>
      entry.kind === "screen" || entry.kind === "component"
        ? {
            ...entry,
            interactive: interactiveEnabled(byId.get(entry.id)),
          }
        : entry,
    ),
    schemaVersion: "live-index-1",
  });
}

function interactiveEnabled(entry: ResolvedRegistryEntry | undefined): boolean {
  return !entry || !("interactive" in entry) || entry.interactive !== false;
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
  const index = value as Record<string, unknown> & {
    entries?: readonly Record<string, unknown>[];
  };
  if (!Array.isArray(index.entries))
    throw new MoklyError("manifest-invalid", "live index needs entries");
  const entries = index.entries.map((entry) => {
    const interactive = entry.interactive;
    const eligible = entry.kind === "screen" || entry.kind === "component";
    if (
      (eligible && typeof interactive !== "boolean") ||
      (!eligible && "interactive" in entry)
    )
      throw new MoklyError(
        "manifest-invalid",
        `${String(entry.id)} has invalid interactive eligibility`,
      );
    const { interactive: _interactive, ...manifestEntry } = entry;
    return manifestEntry;
  });
  const metadata = validateManifestMetadata({
    ...index,
    entries,
    schemaVersion: 7,
  }) as ManifestV7;
  for (const entry of metadata.entries) {
    validateDependencyDeclarations(entry);
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
