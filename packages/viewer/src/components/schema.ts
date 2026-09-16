import { assertPlainData, exactKeys, invalidData, plainKeys } from "./data.js";
import type { DataPropSchema } from "./prop_types.js";

/** Validate the complete declarative schema, including unknown fields. */
export function validatePropSchema(
  value: unknown,
  context = "Component",
): asserts value is DataPropSchema {
  assertPlainData(value, `${context} $schema`, true, 256);
  validate(value, `${context} $schema`, 0);
}

function validate(value: unknown, at: string, depth: number): void {
  if (depth > 64) invalidData(at, "schema depth limit exceeded");
  plainKeys(value, at);
  const schema = value as Record<string, unknown>;
  switch (schema.kind) {
    case "boolean":
    case "null":
      exactKeys(schema, ["kind"], at);
      break;
    case "string":
      exactKeys(schema, ["kind", "minLength", "maxLength"], at);
      bounds(schema, "minLength", "maxLength", at, true);
      break;
    case "number":
      exactKeys(schema, ["kind", "minimum", "maximum", "integer"], at);
      bounds(schema, "minimum", "maximum", at, false);
      if (schema.integer !== undefined && typeof schema.integer !== "boolean")
        invalidData(`${at}.integer`, "expected a boolean");
      break;
    case "enum":
      exactKeys(schema, ["kind", "values"], at);
      if (!Array.isArray(schema.values) || !schema.values.length)
        invalidData(`${at}.values`, "expected nonempty primitive values");
      for (const [i, item] of schema.values.entries()) {
        if (!(
          item === null ||
          typeof item === "string" ||
          typeof item === "boolean" ||
          (typeof item === "number" &&
            Number.isFinite(item) &&
            !Object.is(item, -0))
        ))
          invalidData(
            `${at}.values[${i}]`,
            "expected a lossless primitive literal",
          );
        if (schema.values.slice(0, i).some((other) => Object.is(other, item)))
          invalidData(`${at}.values[${i}]`, "duplicate enum value");
      }
      break;
    case "array":
      exactKeys(schema, ["kind", "items", "minItems", "maxItems"], at);
      bounds(schema, "minItems", "maxItems", at, true);
      validate(schema.items, `${at}.items`, depth + 1);
      break;
    case "object":
      exactKeys(schema, ["kind", "properties"], at);
      for (const key of plainKeys(schema.properties, `${at}.properties`)) {
        const field = (schema.properties as Record<string, unknown>)[key];
        const location = `${at}.properties.${key}`;
        exactKeys(field, ["schema", "optional"], location);
        if (field.optional !== undefined && typeof field.optional !== "boolean")
          invalidData(`${location}.optional`, "expected a boolean");
        validate(field.schema, `${location}.schema`, depth + 1);
      }
      break;
    case "union":
      exactKeys(schema, ["kind", "anyOf"], at);
      if (!Array.isArray(schema.anyOf) || schema.anyOf.length < 2)
        invalidData(`${at}.anyOf`, "union requires at least two schemas");
      schema.anyOf.forEach((member, i) =>
        validate(member, `${at}.anyOf[${i}]`, depth + 1),
      );
      break;
    default:
      invalidData(`${at}.kind`, "unknown schema kind");
  }
}

export function bounds(
  schema: Record<string, unknown>,
  lower: string,
  upper: string,
  at: string,
  counts: boolean,
): void {
  for (const field of [lower, upper]) {
    const value = schema[field];
    if (value === undefined) continue;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      Object.is(value, -0) ||
      (counts && (!Number.isSafeInteger(value) || value < 0))
    )
      invalidData(
        `${at}.${field}`,
        counts
          ? "expected a nonnegative safe integer"
          : "expected a finite number other than negative zero",
      );
  }
  if (
    schema[lower] !== undefined &&
    schema[upper] !== undefined &&
    (schema[lower] as number) > (schema[upper] as number)
  )
    invalidData(at, "lower bound exceeds upper bound");
}
