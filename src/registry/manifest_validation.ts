import { entryRoute, isEntryId, viewRoute } from "@mokly/viewer/data";
import type { ManifestV8 } from "@mokly/viewer/data";

import { incompatibleEarlierBaseline } from "../baseline/compatibility.js";
import { validateManifestComponentUsage } from "../components/manifest_validation.js";
import { MoklyError } from "../errors.js";

import { assertHistoricalLayout } from "./historical_layout.js";
import { normalizeHistoricalManifest } from "./historical_manifest.js";
import { validateManifestEntry } from "./manifest_entries.js";
import { validateManifestRelationships } from "./manifest_relationships.js";
import { record, stringArray, validateRepoPath } from "./manifest_values.js";

/** Validate current JSON against the v8 schema. */
export function validateManifest(
  value: unknown,
  historical = false,
  componentUsage = true,
): ManifestV8 {
  const original = value;
  if (historical) value = normalizeHistoricalManifest(value);
  if (
    historical &&
    record(value) &&
    Number.isInteger(value.schemaVersion) &&
    (value.schemaVersion as number) < 3
  )
    throw incompatibleEarlierBaseline();
  if (!record(value) || !Array.isArray(value.entries))
    failure("manifest must contain an entries array");
  if (value.schemaVersion !== 8 || value.generatedBy !== "mokly")
    failure("expected Mokly manifest schema version 8; run mokly build");
  if (
    Object.keys(value).some(
      (key) =>
        !["entries", "generatedBy", "schemaVersion", "sourceFiles"].includes(
          key,
        ),
    )
  )
    failure("unexpected manifest field");
  if (
    !stringArray(value.sourceFiles) ||
    JSON.stringify(value.sourceFiles) !==
      JSON.stringify([...new Set(value.sourceFiles)].sort())
  )
    failure("sourceFiles must be a sorted unique array");
  for (const source of value.sourceFiles)
    validateRepoPath(source, "sourceFiles");

  const rawEntries = value.entries as Record<string, unknown>[];
  const components = rawEntries.some((entry) => entry?.kind === "component");
  const entries: Record<string, unknown>[] = [];
  const byId = new Map<string, Record<string, unknown>>();
  const outputPaths = new Set<string>();
  for (const rawEntry of rawEntries) {
    if (
      !record(rawEntry) ||
      typeof rawEntry.id !== "string" ||
      typeof rawEntry.kind !== "string"
    )
      failure("every manifest entry needs string id and kind");
    const id = rawEntry.id;
    if (!isEntryId(id)) failure(`invalid manifest id: ${id}`);
    validateManifestEntry(rawEntry, components);
    if (
      !(value.sourceFiles as string[]).includes(rawEntry.sourcePath as string)
    )
      failure(`sourceFiles omits ${String(rawEntry.sourcePath)}`);
    if (byId.has(id)) failure(`duplicate manifest id: ${id}`);
    entries.push(rawEntry);
    byId.set(id, rawEntry);
    addOutputPath(
      outputPaths,
      entryRoute(rawEntry.kind as ManifestV8["entries"][number]["kind"], id),
    );
    if (
      rawEntry.kind === "screen" ||
      (rawEntry.kind === "component" && typeof rawEntry.variantOf === "string")
    )
      for (const viewport of ["mobile", "desktop"] as const)
        for (const colorScheme of rawEntry.colorSchemes as ("light" | "dark")[])
          addOutputPath(
            outputPaths,
            viewRoute(rawEntry.kind, id, viewport, colorScheme),
          );
  }
  validateManifestRelationships(entries, byId);
  if (historical)
    assertHistoricalLayout(original, value as unknown as ManifestV8);
  if (componentUsage) validateManifestComponentUsage(value as never);
  return value as unknown as ManifestV8;
}

/** Validate the same v8 metadata used by the live catalogue boundary. */
export function validateManifestMetadata(value: unknown): ManifestV8 {
  return validateManifest(value, false, false);
}

function addOutputPath(paths: Set<string>, candidate: string): void {
  if (paths.has(candidate)) failure(`duplicate manifest output: ${candidate}`);
  paths.add(candidate);
}

function failure(message: string): never {
  throw new MoklyError("manifest-invalid", message);
}
