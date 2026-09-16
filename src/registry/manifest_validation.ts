import { isCatalogueId } from "@mokly/viewer/data";
import type { HistoricalManifest } from "@mokly/viewer/data";

import {
  componentFragmentPaths,
  validateManifestComponentUsage,
} from "../components/manifest_validation.js";
import { MoklyError } from "../errors.js";

import { validateEntry, validateCurrentFields } from "./manifest_entries.js";
import { validateManifestRelationships } from "./manifest_relationships.js";
import {
  record,
  stringArray,
  validateRepoPath,
  validateRoute,
} from "./manifest_values.js";

/** Validate unknown manifest JSON and normalize temporary schema version 2. */
export function validateManifest(
  value: unknown,
  allowV2: boolean,
  historical = false,
): HistoricalManifest {
  const manifest = validateManifestMetadata(value, allowV2, historical);
  validateManifestComponentUsage(manifest);
  return manifest;
}

/** Shared metadata validation; only the live index omits rendered-view validation. */
export function validateManifestMetadata(
  value: unknown,
  allowV2 = false,
  historical = false,
): HistoricalManifest {
  if (!record(value) || !Array.isArray(value.entries))
    throw new MoklyError(
      "manifest-invalid",
      "manifest must contain an entries array",
    );
  let normalized = value;
  if (value.schemaVersion === 2 && allowV2 && historical) {
    normalized = { ...value, generatedBy: "mokly", schemaVersion: 3 };
  } else if (historical && value.generatedBy === "mokabook") {
    normalized = { ...value, generatedBy: "mokly" };
  }
  const current = normalized.schemaVersion === 5;
  const pages =
    current || (normalized.schemaVersion === 4 && "sourceFiles" in normalized);
  if (
    (!current &&
      !(historical && [3, 4].includes(normalized.schemaVersion as number))) ||
    normalized.generatedBy !== "mokly"
  )
    throw new MoklyError(
      "manifest-invalid",
      "expected Mokly manifest schema version 5; run mokly build",
    );
  if (pages) {
    if (
      Object.keys(normalized).some(
        (key) =>
          !["entries", "generatedBy", "schemaVersion", "sourceFiles"].includes(
            key,
          ),
      )
    )
      throw new MoklyError("manifest-invalid", "unexpected manifest field");
    if (
      !stringArray(normalized.sourceFiles) ||
      JSON.stringify(normalized.sourceFiles) !==
        JSON.stringify([...new Set(normalized.sourceFiles)].sort())
    )
      throw new MoklyError(
        "manifest-invalid",
        "sourceFiles must be a sorted unique array",
      );
    for (const source of normalized.sourceFiles)
      validateRepoPath(source, "sourceFiles");
  } else if (!Array.isArray(normalized.legacyPages))
    throw new MoklyError(
      "manifest-invalid",
      "historical manifest needs legacyPages",
    );
  const entries: Record<string, unknown>[] = [];
  const byId = new Map<string, Record<string, unknown>>();
  const routes = new Set<string>();
  for (const rawEntry of value.entries) {
    if (
      !record(rawEntry) ||
      typeof rawEntry.id !== "string" ||
      typeof rawEntry.kind !== "string"
    ) {
      throw new MoklyError(
        "manifest-invalid",
        "every manifest entry needs string id and kind",
      );
    }
    const entry = rawEntry;
    const id = rawEntry.id;
    if (!isCatalogueId(id)) {
      throw new MoklyError("manifest-invalid", `invalid manifest id: ${id}`);
    }
    if (pages) {
      validateCurrentFields(entry, current);
      if (
        !(normalized.sourceFiles as string[]).includes(
          entry.sourcePath as string,
        )
      )
        throw new MoklyError(
          "manifest-invalid",
          `sourceFiles omits ${String(entry.sourcePath)}`,
        );
    } else if (entry.kind === "page")
      throw new MoklyError(
        "manifest-invalid",
        "pages require the registered-page manifest format",
      );
    validateEntry(entry, current || (normalized.schemaVersion === 4 && !pages));
    if (byId.has(id)) {
      throw new MoklyError("manifest-invalid", `duplicate manifest id: ${id}`);
    }
    entries.push(entry);
    byId.set(id, entry);
    if (entry.kind !== "collection") {
      if (typeof entry.route !== "string" || routes.has(entry.route)) {
        throw new MoklyError(
          "manifest-invalid",
          `invalid or duplicate manifest route for ${entry.id}`,
        );
      }
      routes.add(entry.route);
    }
  }
  const outputRoutes = validateFragmentRoutes(entries, routes);
  if (!pages)
    validateLegacyPages(normalized.legacyPages as unknown[], outputRoutes);
  validateManifestRelationships(entries, byId);
  const manifest = normalized as unknown as HistoricalManifest;
  return manifest;
}

function validateFragmentRoutes(
  entries: readonly Record<string, unknown>[],
  routedEntries: ReadonlySet<string>,
): Set<string> {
  const outputRoutes = new Set(routedEntries);
  for (const entry of entries) {
    if (entry.kind === "component") {
      for (const fragment of componentFragmentPaths(entry)) {
        if (outputRoutes.has(fragment))
          throw new MoklyError(
            "manifest-invalid",
            `colliding component fragment: ${fragment}`,
          );
        outputRoutes.add(fragment);
      }
      continue;
    }
    if (entry.kind !== "screen" || !record(entry.fragments)) continue;
    for (const viewport of ["mobile", "desktop"] as const) {
      const fragment = entry.fragments[viewport] as string;
      const expected = (entry.route as string).replace(
        /\.html$/,
        `.${viewport}.html`,
      );
      if (fragment !== expected || outputRoutes.has(fragment)) {
        throw new MoklyError(
          "manifest-invalid",
          `${String(entry.id)} has invalid or colliding ${viewport} fragment`,
        );
      }
      outputRoutes.add(fragment);
    }
    if (!record(entry.darkFragments)) continue;
    for (const viewport of ["mobile", "desktop"] as const) {
      const fragment = entry.darkFragments[viewport] as string;
      const expected = (entry.route as string).replace(
        /\.html$/,
        `.${viewport}.dark.html`,
      );
      if (fragment !== expected || outputRoutes.has(fragment)) {
        throw new MoklyError(
          "manifest-invalid",
          `${String(entry.id)} has invalid or colliding ${viewport} dark fragment`,
        );
      }
      outputRoutes.add(fragment);
    }
  }
  return outputRoutes;
}

function validateLegacyPages(pages: unknown[], routes: Set<string>): void {
  for (const page of pages) {
    if (
      !record(page) ||
      typeof page.route !== "string" ||
      typeof page.sourcePath !== "string"
    ) {
      throw new MoklyError(
        "manifest-invalid",
        "every legacy page needs route and sourcePath",
      );
    }
    validateRoute(page.route, "legacy page");
    validateRepoPath(page.sourcePath, "legacy page sourcePath");
    if (routes.has(page.route)) {
      throw new MoklyError(
        "manifest-invalid",
        `duplicate manifest route: ${page.route}`,
      );
    }
    routes.add(page.route);
  }
}
