/** Value validation under the prop schema profile, with no generated code. */

import type { PropSchema } from "../generated/catalogue/PropSchema.js";

import {
  ComponentValidationError,
  DataBudget,
  invalidData,
  plainKeys,
  record,
} from "./data.js";
import { schemaTypes } from "./profile_schema.js";

/** Validate one complete JSON value against an already validated schema. */
export function validateProfileValue(
  schema: PropSchema,
  value: unknown,
  at: string,
  budget: DataBudget = new DataBudget(),
  depth = 0,
): void {
  budget.visit(depth, at);
  const types = schemaTypes(schema);
  if (types.size && ![...types].some((type) => hasType(value, type)))
    invalidData(at, `expected ${[...types].join(" or ")}`);
  if (schema.enum && !schema.enum.some((choice) => choice === value))
    invalidData(at, "value is not an allowed option");
  if (Object.hasOwn(schema, "const") && schema.const !== value)
    invalidData(at, "value is not the allowed constant");
  if (
    schema.oneOf &&
    schema.oneOf.filter((choice) => choice.const === value).length !== 1
  )
    invalidData(at, "value is not exactly one allowed choice");
  if (
    schema.anyOf &&
    !schema.anyOf.some((member) => accepts(member, value, budget, depth))
  )
    invalidData(at, "value does not match any allowed schema");
  if (typeof value === "string") checkString(schema, value, at);
  if (typeof value === "number") checkNumber(schema, value, at);
  if (Array.isArray(value)) checkArray(schema, value, at, budget, depth);
  else if (record(value)) checkObject(schema, value, at, budget, depth);
}

/** Whether a value satisfies a schema, without reporting the failure. */
export function profileAccepts(schema: PropSchema, value: unknown): boolean {
  return accepts(schema, value, new DataBudget(), 0);
}

/**
 * Whether `value / multiple` is an integer in the decimal reading that both
 * finite numbers print as, which is the reading the Rust validator uses.
 */
export function isMultipleOf(value: number, multiple: number): boolean {
  if (value === 0) return true;
  const left = decimal(value);
  const right = decimal(multiple);
  if (right.mantissa === 0n) return false;
  const shared = Math.min(left.decimals, right.decimals);
  const scale = (mantissa: bigint, decimals: number) =>
    mantissa * 10n ** BigInt(decimals - shared);
  return (
    scale(left.mantissa, right.decimals) %
      scale(right.mantissa, left.decimals) ===
    0n
  );
}

function accepts(
  schema: PropSchema,
  value: unknown,
  budget: DataBudget,
  depth: number,
): boolean {
  try {
    validateProfileValue(schema, value, "$", budget, depth + 1);
    return true;
  } catch (error) {
    if (
      error instanceof ComponentValidationError &&
      error.detail === "validation limit exceeded"
    )
      throw error;
    return false;
  }
}

function checkString(schema: PropSchema, value: string, at: string): void {
  const length = [...value].length;
  if (length < (schema.minLength ?? 0))
    invalidData(at, "string is shorter than its minimum length");
  if (length > (schema.maxLength ?? Infinity))
    invalidData(at, "string is longer than its maximum length");
}

function checkNumber(schema: PropSchema, value: number, at: string): void {
  if (value < (schema.minimum ?? -Infinity))
    invalidData(at, "number is below its minimum");
  if (value > (schema.maximum ?? Infinity))
    invalidData(at, "number is above its maximum");
  if (
    schema.multipleOf !== undefined &&
    !isMultipleOf(value, schema.multipleOf)
  )
    invalidData(at, "number is not a multiple of its step");
}

function checkArray(
  schema: PropSchema,
  value: readonly unknown[],
  at: string,
  budget: DataBudget,
  depth: number,
): void {
  if (value.length < (schema.minItems ?? 0))
    invalidData(at, "array has too few items");
  if (value.length > (schema.maxItems ?? Infinity))
    invalidData(at, "array has too many items");
  const items = schema.items;
  if (items)
    value.forEach((item, index) =>
      validateProfileValue(items, item, `${at}[${index}]`, budget, depth + 1),
    );
}

function checkObject(
  schema: PropSchema,
  value: Record<string, unknown>,
  at: string,
  budget: DataBudget,
  depth: number,
): void {
  if (!schemaTypes(schema).has("object")) return;
  const properties = schema.properties ?? {};
  for (const key of plainKeys(value, at)) {
    const property = Object.hasOwn(properties, key)
      ? properties[key]
      : undefined;
    if (!property) invalidData(`${at}.${key}`, "unknown prop");
    validateProfileValue(
      property,
      value[key],
      `${at}.${key}`,
      budget,
      depth + 1,
    );
  }
  for (const key of schema.required ?? [])
    if (!Object.hasOwn(value, key))
      invalidData(`${at}.${key}`, "required prop is missing");
}

function hasType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return record(value);
    default:
      return false;
  }
}

function decimal(value: number): { mantissa: bigint; decimals: number } {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(value));
  if (!match) return { mantissa: 0n, decimals: 0 };
  const [, sign, whole = "0", fraction = "", exponent = "0"] = match;
  const digits = BigInt(`${whole}${fraction}`);
  return {
    mantissa: sign ? -digits : digits,
    decimals: fraction.length - Number(exponent),
  };
}
