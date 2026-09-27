import type { ManifestComponent } from "@mokly/viewer";
import {
  canonicalJson,
  decodeProps,
  exactKeys,
  invalidData,
  isCatalogueId,
  isEntryId,
  isSafeCatalogueRoute,
  sortedStrings,
  validateControlledValues,
  validateControls,
  validateProps,
  validatePropSchema,
  viewRoute,
} from "@mokly/viewer/data";

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

/** Validate one component parent or flattened component variant. */
export function validateManifestComponent(
  value: Record<string, unknown>,
): void {
  if (typeof value.variantOf === "string") {
    validateVariantEntry(value);
    return;
  }
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
      ...(Array.isArray(value.variants) ? ["variants"] : []),
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
  validateTags(value.tags, at);
  validateViewports(value.viewports, at);
  if (value.variants === undefined) return;
  if (!Array.isArray(value.variants) || !value.variants.length)
    invalidData(at, "historical component requires saved variants");
  const ids = new Set<string>();
  let dark: boolean | undefined;
  for (const raw of value.variants) {
    validateLegacyVariant(
      raw,
      value as unknown as ManifestComponent,
      declaredSlots,
      at,
    );
    if (ids.has(raw.id)) invalidData(at, "duplicate historical variant id");
    ids.add(raw.id);
    const hasDark = raw.darkFragments !== undefined;
    if (dark !== undefined && dark !== hasDark)
      invalidData(at, "variant schemes must agree");
    dark = hasDark;
  }
}

function validateVariantEntry(value: Record<string, unknown>): void {
  const at = `${String(value.id)} $component-variant`;
  exactKeys(
    value,
    [
      ...commonKeys,
      "route",
      "viewports",
      "tags",
      "variantOf",
      "props",
      "suppliedSlots",
      "fragments",
      "darkFragments",
      "componentViews",
    ],
    at,
  );
  if (!isEntryId(value.variantOf)) invalidData(at, "invalid variantOf");
  validateTags(value.tags, at);
  validateViewports(value.viewports, at);
  sortedStrings(value.suppliedSlots, `${at}.suppliedSlots`);
  decodeProps(value.props);
  validateFragmentFields(value, String(value.id), at);
}

function validateLegacyVariant(
  raw: Record<string, unknown>,
  parent: ManifestComponent,
  declaredSlots: readonly string[],
  at: string,
): void {
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
  if (!isEntryId(raw.id)) invalidData(at, "invalid historical variant id");
  if (
    typeof raw.title !== "string" ||
    !raw.title.trim() ||
    (raw.description !== undefined &&
      (typeof raw.description !== "string" || !raw.description.trim()))
  )
    invalidData(at, "invalid variant title/description");
  sortedStrings(raw.suppliedSlots, `${at}.${String(raw.id)}.suppliedSlots`);
  if (!raw.suppliedSlots.every((slot) => declaredSlots.includes(slot)))
    invalidData(at, "unknown supplied slot");
  const data = validateProps(
    parent.propSchema,
    decodeProps(raw.props),
    `${at}.${String(raw.id)}`,
  );
  validateControlledValues(parent.controls, data, `${at}.${String(raw.id)}`);
  for (const key of ["fragments", "darkFragments"] as const) {
    if (key === "darkFragments" && raw[key] === undefined) continue;
    exactKeys(
      raw[key],
      ["mobile", "desktop"],
      `${at}.${String(raw.id)}.${key}`,
    );
    for (const viewport of ["mobile", "desktop"] as const) {
      const fragment = (raw[key] as Record<string, unknown>)[viewport];
      if (typeof fragment !== "string" || !isSafeCatalogueRoute(fragment))
        invalidData(at, "invalid historical variant fragment path");
    }
  }
}

function validateFragmentFields(
  value: Record<string, unknown>,
  id: string,
  at: string,
): void {
  for (const key of ["fragments", "darkFragments"] as const) {
    if (key === "darkFragments" && value[key] === undefined) continue;
    exactKeys(value[key], ["mobile", "desktop"], `${at}.${key}`);
    for (const viewport of ["mobile", "desktop"] as const) {
      const fragment = (value[key] as Record<string, unknown>)[viewport];
      if (
        typeof fragment !== "string" ||
        !isSafeCatalogueRoute(fragment) ||
        fragment !==
          viewRoute(
            "component",
            id,
            viewport,
            key === "fragments" ? "light" : "dark",
          )
      )
        invalidData(at, "invalid variant fragment path");
    }
  }
}

function validateTags(value: unknown, at: string): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) ||
      !value.every(isCatalogueId) ||
      new Set(value).size !== value.length)
  )
    invalidData(at, "invalid component tags");
}

function validateViewports(value: unknown, at: string): void {
  if (canonicalJson(value) !== '["mobile","desktop"]')
    invalidData(at, "component requires both viewports");
}
