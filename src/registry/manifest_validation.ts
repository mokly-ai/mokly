import {
  entryRoute,
  isEntryId,
  legacyComponentVariantId,
  viewRoute,
} from "@mokly/viewer/data";
import type { HistoricalManifest, ManifestV7 } from "@mokly/viewer/data";

import {
  componentFragmentPaths,
  validateManifestComponentUsage,
} from "../components/manifest_validation.js";
import { MoklyError } from "../errors.js";

import { normalizeHistoricalManifest } from "./historical_manifest.js";
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
): HistoricalManifest | ManifestV7 {
  const manifest = validateRawManifestMetadata(value, allowV2, historical);
  validateManifestComponentUsage(manifest);
  return historical
    ? normalizeHistoricalManifest(manifest)
    : (manifest as unknown as ManifestV7);
}

/** Shared metadata validation; only the live index omits rendered-view validation. */
export function validateManifestMetadata(value: unknown): ManifestV7 {
  return validateRawManifestMetadata(
    value,
    false,
    false,
  ) as unknown as ManifestV7;
}

interface ValidatedRawManifest {
  entries: readonly Record<string, unknown>[];
  generatedBy: "mokly";
  legacyPages?: readonly Record<string, unknown>[];
  schemaVersion: 3 | 4 | 5 | 6 | 7;
  sourceFiles?: readonly string[];
}

function validateRawManifestMetadata(
  value: unknown,
  allowV2: boolean,
  historical: boolean,
): ValidatedRawManifest {
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
  const current = normalized.schemaVersion === 7;
  const components =
    [5, 6, 7].includes(normalized.schemaVersion as number) ||
    (normalized.schemaVersion === 4 && !("sourceFiles" in normalized));
  const historicalCollection =
    historical && [3, 4, 5].includes(normalized.schemaVersion as number);
  const pages =
    [5, 6, 7].includes(normalized.schemaVersion as number) ||
    (normalized.schemaVersion === 4 && "sourceFiles" in normalized);
  if (
    (!current &&
      !(
        historical &&
        [3, 4, 5, 6, 7].includes(normalized.schemaVersion as number)
      )) ||
    normalized.generatedBy !== "mokly"
  )
    throw new MoklyError(
      "manifest-invalid",
      "expected Mokly manifest schema version 7; run mokly build",
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
    if (!isEntryId(id)) {
      throw new MoklyError("manifest-invalid", `invalid manifest id: ${id}`);
    }
    if (pages) {
      validateCurrentFields(entry, components, historicalCollection, current);
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
    validateEntry(entry, components, historicalCollection, current);
    if (byId.has(id)) {
      throw new MoklyError("manifest-invalid", `duplicate manifest id: ${id}`);
    }
    entries.push(entry);
    byId.set(id, entry);
    if (entry.kind !== "collection") {
      const route = current
        ? entryRoute(
            entry.kind as "component" | "page" | "screen" | "use-case",
            id,
          )
        : entry.route;
      if (typeof route !== "string" || routes.has(route)) {
        throw new MoklyError(
          "manifest-invalid",
          `invalid or duplicate manifest route for ${entry.id}`,
        );
      }
      routes.add(route);
    }
  }
  if (historical) validateHistoricalComponentVariantIds(entries);
  const outputRoutes = validateFragmentRoutes(entries, routes, current);
  if (!pages)
    validateLegacyPages(normalized.legacyPages as unknown[], outputRoutes);
  validateManifestRelationships(
    entries,
    byId,
    historicalCollection
      ? "historical-collections"
      : historical
        ? "historical"
        : "current",
  );
  return {
    ...normalized,
    entries: historicalCollection
      ? entries.filter((entry) => entry.kind !== "collection")
      : entries,
  } as unknown as ValidatedRawManifest;
}

function validateHistoricalComponentVariantIds(
  entries: readonly Record<string, unknown>[],
): void {
  const occupied = new Map(
    entries.map((entry) => [
      entry.id as string,
      `manifest entry ${String(entry.id)}`,
    ]),
  );
  for (const entry of entries) {
    if (entry.kind !== "component" || !Array.isArray(entry.variants)) continue;
    for (const raw of entry.variants) {
      if (!record(raw) || typeof raw.id !== "string") continue;
      const id = legacyComponentVariantId(entry.id as string, raw.id);
      const previous = occupied.get(id);
      if (previous !== undefined) {
        throw new MoklyError(
          "manifest-invalid",
          `historical component variant ${String(entry.id)} / ${raw.id} expands to ${id}, which conflicts with ${previous}`,
        );
      }
      occupied.set(
        id,
        `historical component variant ${String(entry.id)} / ${raw.id}`,
      );
    }
  }
}

function validateFragmentRoutes(
  entries: readonly Record<string, unknown>[],
  routedEntries: ReadonlySet<string>,
  derived: boolean,
): Set<string> {
  const outputRoutes = new Set(routedEntries);
  for (const entry of entries) {
    if (entry.kind === "component") {
      const fragments = derived
        ? typeof entry.variantOf === "string"
          ? (["mobile", "desktop"] as const).flatMap((viewport) =>
              (entry.colorSchemes as ("light" | "dark")[]).map((scheme) =>
                viewRoute("component", entry.id as string, viewport, scheme),
              ),
            )
          : []
        : componentFragmentPaths(entry);
      for (const fragment of fragments) {
        if (outputRoutes.has(fragment))
          throw new MoklyError(
            "manifest-invalid",
            `colliding component fragment: ${fragment}`,
          );
        outputRoutes.add(fragment);
      }
      continue;
    }
    if (entry.kind !== "screen") continue;
    if (derived) {
      for (const viewport of ["mobile", "desktop"] as const)
        for (const scheme of entry.colorSchemes as ("light" | "dark")[]) {
          const fragment = viewRoute(
            "screen",
            entry.id as string,
            viewport,
            scheme,
          );
          if (outputRoutes.has(fragment))
            throw new MoklyError(
              "manifest-invalid",
              `colliding screen view: ${fragment}`,
            );
          outputRoutes.add(fragment);
        }
      continue;
    }
    if (!record(entry.fragments)) continue;
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
