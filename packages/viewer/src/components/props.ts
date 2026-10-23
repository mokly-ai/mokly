import type { PropSchema } from "../generated/catalogue/PropSchema.js";

import { assertPlainData } from "./data.js";
import { validatePropSchema } from "./profile_schema.js";
import { validateProfileValue } from "./profile_value.js";
import type { ComponentPropsData } from "./prop_types.js";

/** Validate a schema and one complete props value under the shared profile. */
export function validateProps(
  schema: PropSchema,
  value: unknown,
  context = "Component",
): ComponentPropsData {
  validatePropSchema(schema, context);
  assertPlainData(value, `${context} $`);
  validateProfileValue(schema, value, `${context} $`);
  return value as ComponentPropsData;
}

/** The schema of one declared top-level property, when the root declares it. */
export function propertySchema(
  schema: PropSchema,
  key: string,
): PropSchema | undefined {
  const properties = schema.properties ?? {};
  return Object.hasOwn(properties, key) ? properties[key] : undefined;
}

/** Whether a declared top-level property is optional under the root schema. */
export function optionalProperty(schema: PropSchema, key: string): boolean {
  return (
    propertySchema(schema, key) !== undefined &&
    !(schema.required ?? []).includes(key)
  );
}
