import type { ManifestComponent } from "@mokly/viewer";
import {
  decodeProps,
  exactKeys,
  invalidData,
  isKebabCase,
  isEntryPath,
  sortedStrings,
  validateControlledValues,
  validateControls,
  validateProps,
  validatePropSchema,
} from "@mokly/viewer/data";

import { validateColorSchemes } from "../registry/manifest_values.js";

const COMMON_KEYS = [
  "path",
  "title",
  "description",
  "rationale",
  "movedFrom",
  "relatedDocs",
  "sourcePath",
  "kind",
  "colorSchemes",
  "tags",
] as const;

/** Validate one identity-only v10 component parent or flattened variant. */
export function validateManifestComponent(
  value: Record<string, unknown>,
): void {
  if (typeof value.variantOf === "string") {
    validateVariantEntry(value);
    return;
  }
  const at = `${String(value.path)} $component`;
  exactKeys(value, [...COMMON_KEYS, "propSchema", "slots", "controls"], at);
  validatePropSchema(value.propSchema, at);
  if (value.propSchema.kind !== "object")
    invalidData(at, "component propSchema must be an object");
  const schema = value.propSchema;
  sortedStrings(value.slots, `${at}.slots`);
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
  validateControls(schema, value.controls, at);
  validateTags(value.tags, at);
  validateColorSchemes(value.colorSchemes, at);
}

function validateVariantEntry(value: Record<string, unknown>): void {
  const at = `${String(value.path)} $component-variant`;
  exactKeys(
    value,
    [...COMMON_KEYS, "variantOf", "props", "suppliedSlots", "componentViews"],
    at,
  );
  if (!isEntryPath(value.variantOf)) invalidData(at, "invalid variantOf");
  validateTags(value.tags, at);
  validateColorSchemes(value.colorSchemes, at);
  sortedStrings(value.suppliedSlots, `${at}.suppliedSlots`);
  decodeProps(value.props);
}

/** Validate a v10 variant's data against its already-validated parent. */
export function validateVariantAgainstParent(
  variant: Record<string, unknown>,
  parent: ManifestComponent,
): void {
  const suppliedSlots = variant.suppliedSlots as string[];
  if (!suppliedSlots.every((slot) => parent.slots.includes(slot)))
    invalidData(variant.path as string, "unknown supplied slot");
  const data = validateProps(
    parent.propSchema,
    decodeProps(variant.props as never),
    variant.path as string,
  );
  validateControlledValues(parent.controls, data, variant.path as string);
}

function validateTags(value: unknown, at: string): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) ||
      !value.every(isKebabCase) ||
      new Set(value).size !== value.length)
  )
    invalidData(at, "invalid component tags");
}
