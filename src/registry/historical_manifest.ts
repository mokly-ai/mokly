import { isStylesheetPath, validateResourcePath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { record, stringArray } from "./manifest_values.js";

const REMOVED_FIELDS = [
  "dependencies",
  "declaredDependencies",
  "ownedDependencies",
] as const;

/** Normalize supported earlier metadata before the current validator reads it. */
export function normalizeHistoricalManifest(value: unknown): unknown {
  value = dropHistoricalCssOwners(value);
  if (
    !record(value) ||
    typeof value.schemaVersion !== "number" ||
    ![3, 4, 5, 6, 7].includes(value.schemaVersion)
  )
    return value;
  if (!Array.isArray(value.entries)) return value;
  if (value.generatedBy !== "mokly" && value.generatedBy !== "mokabook")
    return value;
  const version = value.schemaVersion;
  const entries = value.entries.flatMap((raw): Record<string, unknown>[] => {
    if (!record(raw))
      throw new MoklyError("manifest-invalid", "invalid historical entry");
    if (raw.kind === "collection") return [];
    const entry = stripRemovedFields(raw);
    if (version === 7) return [entry];
    for (const field of ["route", "fragments", "darkFragments", "viewports"])
      delete entry[field];
    if (raw.kind === "screen")
      entry.colorSchemes =
        raw.colorSchemes ?? (raw.darkFragments ? ["light", "dark"] : ["light"]);
    if (raw.kind !== "component") return [entry];
    const variants = raw.variants;
    if (!Array.isArray(variants)) return [entry];
    delete entry.variants;
    entry.colorSchemes = variants.some(
      (variant) => record(variant) && variant.darkFragments,
    )
      ? ["light", "dark"]
      : ["light"];
    return [
      entry,
      ...variants.map((rawVariant) => {
        if (!record(rawVariant) || typeof rawVariant.id !== "string")
          throw new MoklyError(
            "manifest-invalid",
            "invalid historical component variant",
          );
        const variant = stripRemovedFields(rawVariant);
        for (const field of [
          "fragments",
          "darkFragments",
          "viewports",
          "route",
        ])
          delete variant[field];
        return {
          description: entry.description,
          navPath: entry.navPath,
          relatedDocs: entry.relatedDocs,
          sourcePath: entry.sourcePath,
          ...(entry.tags ? { tags: entry.tags } : {}),
          ...variant,
          id: rawVariant.id.startsWith(`${String(entry.id)}-`)
            ? rawVariant.id
            : `${String(entry.id)}-${rawVariant.id}`,
          kind: "component",
          variantOf: entry.id,
          colorSchemes: rawVariant.darkFragments
            ? ["light", "dark"]
            : ["light"],
        };
      }),
    ];
  });
  if (
    (version >= 5 || value.sourceFiles !== undefined) &&
    !stringArray(value.sourceFiles)
  )
    throw new MoklyError(
      "manifest-invalid",
      "historical sourceFiles must be an array",
    );
  const legacySources = Array.isArray(value.legacyPages)
    ? value.legacyPages.flatMap((page) =>
        record(page) && typeof page.sourcePath === "string"
          ? [page.sourcePath]
          : [],
      )
    : [];
  const entrySources = value.entries.flatMap((entry) =>
    record(entry) && typeof entry.sourcePath === "string"
      ? [entry.sourcePath]
      : [],
  );
  const normalized: Record<string, unknown> = {
    ...value,
    schemaVersion: 8,
    generatedBy: "mokly",
    entries,
    sourceFiles:
      value.sourceFiles ??
      [...new Set([...legacySources, ...entrySources])].sort(),
  };
  delete normalized.legacyPages;
  return normalized;
}

/** Earlier v8 output also carried owners; this is strictly a historical boundary. */
function dropHistoricalCssOwners(value: unknown): unknown {
  if (!record(value) || !Array.isArray(value.entries)) return value;
  const normalize = (entry: unknown): unknown => {
    if (!record(entry)) return entry;
    return {
      ...entry,
      ...(Array.isArray(entry.variants)
        ? { variants: entry.variants.map(normalize) }
        : {}),
      ...(Array.isArray(entry.componentViews)
        ? {
            componentViews: entry.componentViews.map((view: unknown) => {
              if (!record(view) || !Array.isArray(view.resources)) return view;
              return {
                ...view,
                resources: view.resources.filter((resource: unknown) => {
                  if (!record(resource) || typeof resource.path !== "string")
                    return true;
                  validateResourcePath(resource.path, "$historical");
                  return !isStylesheetPath(resource.path);
                }),
              };
            }),
          }
        : {}),
    };
  };
  return { ...value, entries: value.entries.map(normalize) };
}

function stripRemovedFields(
  entry: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...entry };
  for (const field of REMOVED_FIELDS) delete normalized[field];
  return normalized;
}
