import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "@mokly/viewer";
import type { Manifest } from "@mokly/viewer/data";
import {
  isSafeCatalogueRoute,
  isCatalogueId,
  decodeProps,
  validateControlledValues,
  validateControls,
  canonicalJson,
  exactKeys,
  invalidData,
  componentFragmentRoute,
  validateProps,
  validatePropSchema,
  sortedStrings,
  validateComponentViews,
} from "@mokly/viewer/data";

import { validateDependencyDeclarations } from "./dependency_validation.js";

const commonKeys = [
  "id",
  "title",
  "description",
  "rationale",
  "relatedDocs",
  "dependencies",
  "declaredDependencies",
  "sourcePath",
  "navPath",
  "kind",
];

/** Component-specific manifest fields; inherited metadata uses the existing validator. */
export function validateManifestComponent(
  value: Record<string, unknown>,
): void {
  const at = `${String(value.id)} $component`;
  exactKeys(
    value,
    [
      ...commonKeys,
      "route",
      "viewports",
      "tags",
      "propSchema",
      "slots",
      "controls",
      "ownedDependencies",
      "variants",
    ],
    at,
  );
  validatePropSchema(value.propSchema, at);
  if (value.propSchema.kind !== "object")
    invalidData(at, "component propSchema must be an object");
  const schema = value.propSchema;
  sortedStrings(value.slots, `${at}.slots`);
  const declaredSlots = value.slots;
  sortedStrings(value.ownedDependencies, `${at}.ownedDependencies`);
  for (const key of [...Object.keys(schema.properties), ...value.slots]) {
    if (
      [
        "moklyInstance",
        "__moklySource",
        "key",
        "ref",
        "__proto__",
        "constructor",
        "prototype",
      ].includes(key)
    )
      invalidData(at, "reserved prop/slot name");
    if (value.slots.includes(key) && Object.hasOwn(schema.properties, key))
      invalidData(at, "data and slots overlap");
  }
  for (const dependency of value.ownedDependencies)
    if (!(value.dependencies as string[]).includes(dependency))
      invalidData(at, "owned dependencies must be declared dependencies");
  validateControls(schema, value.controls, at);
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) ||
      !value.tags.every(isCatalogueId) ||
      new Set(value.tags).size !== value.tags.length)
  )
    invalidData(at, "invalid component tags");
  if (canonicalJson(value.viewports) !== '["mobile","desktop"]')
    invalidData(at, "component requires both viewports");
  if (!Array.isArray(value.variants) || !value.variants.length)
    invalidData(at, "component requires saved variants");
  const ids = new Set<string>();
  let dark: boolean | undefined;
  for (const raw of value.variants) {
    exactKeys(
      raw,
      [
        "id",
        "title",
        "description",
        "props",
        "suppliedSlots",
        "fragments",
        "darkFragments",
        "componentViews",
      ],
      at,
    );
    if (!isCatalogueId(raw.id) || ids.has(raw.id))
      invalidData(at, "invalid or duplicate variant id");
    ids.add(raw.id);
    if (
      typeof raw.title !== "string" ||
      !raw.title.trim() ||
      (raw.description !== undefined &&
        (typeof raw.description !== "string" || !raw.description.trim()))
    )
      invalidData(at, "invalid variant title/description");
    sortedStrings(raw.suppliedSlots, `${at}.${raw.id}.suppliedSlots`);
    if (!raw.suppliedSlots.every((slot) => declaredSlots.includes(slot)))
      invalidData(at, "unknown supplied slot");
    const data = validateProps(
      schema,
      decodeProps(raw.props),
      `${at}.${raw.id}`,
    );
    validateControlledValues(value.controls, data, `${at}.${raw.id}`);
    for (const key of ["fragments", "darkFragments"] as const) {
      if (key === "darkFragments" && raw[key] === undefined) continue;
      exactKeys(raw[key], ["mobile", "desktop"], `${at}.${raw.id}.${key}`);
      for (const viewport of ["mobile", "desktop"] as const) {
        const fragment = (raw[key] as Record<string, unknown>)[viewport];
        if (
          typeof fragment !== "string" ||
          !isSafeCatalogueRoute(fragment) ||
          fragment !==
            componentFragmentRoute(
              value.route as string,
              raw.id,
              viewport,
              key === "fragments" ? "light" : "dark",
            )
        )
          invalidData(at, "invalid variant fragment path");
      }
    }
    const hasDark = raw.darkFragments !== undefined;
    if (dark !== undefined && dark !== hasDark)
      invalidData(at, "variant schemes must agree");
    dark = hasDark;
  }
}

/** Validate every per-view record against the complete registered component set. */
export function validateManifestComponentUsage(manifest: Manifest): void {
  if (
    manifest.schemaVersion !== 5 &&
    (manifest.schemaVersion !== 4 || "sourceFiles" in manifest)
  )
    return;
  exactKeys(
    manifest,
    [
      "schemaVersion",
      "generatedBy",
      "entries",
      manifest.schemaVersion === 5 ? "sourceFiles" : "legacyPages",
    ],
    "$manifest",
  );
  const components = new Map<string, ManifestComponent>(
    manifest.entries.flatMap((entry) =>
      entry.kind === "component" ? [[entry.id, entry] as const] : [],
    ),
  );
  if (!components.size && manifest.schemaVersion === 4)
    invalidData("$manifest", "v4 requires registered components");
  for (const entry of manifest.entries) {
    validateDependencyDeclarations(entry);
    if (entry.kind === "screen") {
      if (components.size)
        validateComponentViews(
          entry.componentViews,
          entry.darkFragments !== undefined,
          components,
          entry.id,
        );
      else if (entry.componentViews !== undefined)
        invalidData(entry.id, "component usage requires registered components");
    }
    if (entry.kind === "component")
      for (const variant of entry.variants)
        validateComponentViews(
          variant.componentViews,
          variant.darkFragments !== undefined,
          components,
          `${entry.id} / ${variant.id}`,
          entry.id,
        );
  }
}

export function componentFragmentPaths(
  entry: Record<string, unknown>,
): string[] {
  const component = entry as unknown as ManifestComponent;
  return component.variants.flatMap((variant: ManifestComponentVariant) => [
    ...Object.values(variant.fragments),
    ...Object.values(variant.darkFragments ?? {}),
  ]);
}
