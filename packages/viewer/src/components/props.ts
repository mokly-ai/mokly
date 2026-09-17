import { assertPlainData, invalidData, record } from "./data.js";
import type {
  ComponentPropsData,
  DataPropSchema,
  ObjectPropSchema,
  PropValue,
} from "./prop_types.js";
import { validatePropSchema } from "./schema.js";

/** Validate and copy every field, independent of whether it has a control. */
export function validateProps(
  schema: ObjectPropSchema,
  value: unknown,
  context = "Component",
): ComponentPropsData {
  validatePropSchema(schema, context);
  assertPlainData(value, `${context} $`, true);
  return validateValue(schema, value, `${context} $`) as ComponentPropsData;
}

export function validateValue(
  schema: DataPropSchema,
  value: unknown,
  at: string,
): PropValue {
  switch (schema.kind) {
    case "string":
      if (
        typeof value !== "string" ||
        value.length < (schema.minLength ?? 0) ||
        value.length > (schema.maxLength ?? Infinity)
      )
        invalidData(at, "string does not satisfy its length constraints");
      return value;
    case "boolean":
      if (typeof value !== "boolean") invalidData(at, "expected a boolean");
      return value;
    case "number":
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (schema.integer && !Number.isSafeInteger(value)) ||
        value < (schema.minimum ?? -Infinity) ||
        value > (schema.maximum ?? Infinity)
      )
        invalidData(at, "number does not satisfy its constraints");
      return value;
    case "null":
      if (value !== null) invalidData(at, "expected null");
      return null;
    case "enum":
      if (!schema.values.some((item) => Object.is(item, value)))
        invalidData(at, "value is not an allowed option");
      return value as PropValue;
    case "array":
      if (
        !Array.isArray(value) ||
        value.length < (schema.minItems ?? 0) ||
        value.length > (schema.maxItems ?? Infinity)
      )
        invalidData(at, "array does not satisfy its size constraints");
      return value.map((item, i) =>
        validateValue(schema.items, item, `${at}[${i}]`),
      );
    case "object": {
      if (!record(value)) invalidData(at, "expected an object");
      for (const key of Object.keys(value))
        if (!Object.hasOwn(schema.properties, key))
          invalidData(`${at}.${key}`, "unknown prop");
      const result: Record<string, PropValue> = {};
      for (const key of Object.keys(schema.properties).sort()) {
        const field = schema.properties[key]!;
        if (value[key] === undefined && field.optional) continue;
        if (value[key] === undefined)
          invalidData(`${at}.${key}`, "required prop is missing");
        result[key] = validateValue(field.schema, value[key], `${at}.${key}`);
      }
      return result;
    }
    case "union":
      for (const member of schema.anyOf) {
        try {
          return validateValue(member, value, at);
        } catch {
          continue;
        }
      }
      return invalidData(at, "value does not match any allowed schema");
  }
}
