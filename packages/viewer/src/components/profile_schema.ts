/** The prop schema profile of JSON Schema 2020-12, checked without code generation. */

import type { PropSchema } from "../generated/catalogue/PropSchema.js";

import { DataBudget, invalidData, plainKeys, record } from "./data.js";

const KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "enum",
  "const",
  "oneOf",
  "anyOf",
  "items",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "multipleOf",
  "title",
  "description",
  "$schema",
]);
const TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "null",
  "object",
  "array",
]);
const DRAFT = "https://json-schema.org/draft/2020-12/schema";
const TYPED_KEYWORDS: readonly (readonly [string, readonly string[]])[] = [
  ["object", ["properties", "required", "additionalProperties"]],
  ["array", ["items", "minItems", "maxItems"]],
  ["string", ["minLength", "maxLength"]],
];
const BOUNDS: readonly (readonly [string, string, boolean])[] = [
  ["minimum", "maximum", false],
  ["minItems", "maxItems", true],
  ["minLength", "maxLength", true],
];

/** Validate one serialized prop schema, the root included, under the profile. */
export function validatePropSchema(
  value: unknown,
  context = "Component",
): asserts value is PropSchema {
  check(value, `${context} $schema`, true, new DataBudget(), 0);
}

/** The declared JSON types of one schema, or none when it declares no `type`. */
export function schemaTypes(schema: PropSchema): ReadonlySet<string> {
  const type = schema.type;
  return new Set(
    type === undefined ? [] : typeof type === "string" ? [type] : type,
  );
}

/** Whether a JSON value is a primitive: a string, number, boolean or null. */
export function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function check(
  value: unknown,
  at: string,
  root: boolean,
  budget: DataBudget,
  depth: number,
): void {
  budget.visit(depth, at);
  const keys = plainKeys(value, at);
  const schema = value as Record<string, unknown>;
  for (const key of keys)
    if (!KEYWORDS.has(key))
      invalidData(`${at}.${key}`, "keyword is outside the prop schema profile");
  if (
    !["type", "enum", "const", "oneOf", "anyOf"].some((key) =>
      Object.hasOwn(schema, key),
    )
  )
    invalidData(at, "schema must declare type, enum, const, oneOf or anyOf");
  const types = readTypes(schema.type, `${at}.type`);
  if (root && schema.type !== "object")
    invalidData(`${at}.type`, "root schema type must be object");
  for (const [kind, keywords] of TYPED_KEYWORDS)
    for (const key of keywords)
      if (Object.hasOwn(schema, key) && !types.has(kind))
        invalidData(`${at}.${key}`, "keyword requires its matching type");
  for (const key of ["minimum", "maximum", "multipleOf"])
    if (
      Object.hasOwn(schema, key) &&
      !types.has("number") &&
      !types.has("integer")
    )
      invalidData(`${at}.${key}`, "numeric keyword requires a numeric type");
  checkBounds(schema, at);
  if (types.has("object") && schema.additionalProperties !== false)
    invalidData(
      `${at}.additionalProperties`,
      "object schemas require additionalProperties: false",
    );
  if (Object.hasOwn(schema, "$schema") && (!root || schema.$schema !== DRAFT))
    invalidData(`${at}.$schema`, "$schema is root-only and selects 2020-12");
  for (const key of ["title", "description"])
    if (Object.hasOwn(schema, key) && typeof schema[key] !== "string")
      invalidData(`${at}.${key}`, "expected a string");
  const properties = Object.hasOwn(schema, "properties")
    ? plainKeys(schema.properties, `${at}.properties`)
    : [];
  for (const name of properties)
    check(
      (schema.properties as Record<string, unknown>)[name],
      `${at}.properties.${name}`,
      false,
      budget,
      depth + 1,
    );
  if (Object.hasOwn(schema, "required")) {
    const required = schema.required;
    if (
      !Array.isArray(required) ||
      required.some(
        (name, index) =>
          typeof name !== "string" ||
          !properties.includes(name) ||
          required.indexOf(name) !== index,
      )
    )
      invalidData(`${at}.required`, "required names declared properties once");
  }
  if (Object.hasOwn(schema, "const") && !isPrimitive(schema.const))
    invalidData(`${at}.const`, "const must be a JSON primitive");
  if (Object.hasOwn(schema, "enum")) {
    const values = schema.enum;
    if (!Array.isArray(values) || !values.every(isPrimitive))
      invalidData(`${at}.enum`, "enum values must be JSON primitives");
  }
  if (Object.hasOwn(schema, "oneOf")) checkChoices(schema.oneOf, at);
  if (Object.hasOwn(schema, "anyOf")) {
    const members = schema.anyOf;
    if (!Array.isArray(members) || !members.length)
      invalidData(`${at}.anyOf`, "anyOf needs at least one schema");
    members.forEach((member, index) =>
      check(member, `${at}.anyOf[${index}]`, false, budget, depth + 1),
    );
  }
  if (Object.hasOwn(schema, "items"))
    check(schema.items, `${at}.items`, false, budget, depth + 1);
}

function readTypes(value: unknown, at: string): ReadonlySet<string> {
  if (value === undefined) return new Set();
  const names = typeof value === "string" ? [value] : value;
  if (
    !Array.isArray(names) ||
    !names.length ||
    names.some(
      (name, index) =>
        typeof name !== "string" ||
        !TYPES.has(name) ||
        names.indexOf(name) !== index,
    )
  )
    invalidData(at, "type must name unique JSON types");
  return new Set(names as string[]);
}

function checkBounds(schema: Record<string, unknown>, at: string): void {
  for (const [lower, upper, count] of BOUNDS)
    for (const key of [lower, upper]) {
      if (!Object.hasOwn(schema, key)) continue;
      const bound = schema[key];
      if (
        typeof bound !== "number" ||
        !Number.isFinite(bound) ||
        Object.is(bound, -0) ||
        (count && (!Number.isSafeInteger(bound) || bound < 0))
      )
        invalidData(
          `${at}.${key}`,
          count
            ? "expected a nonnegative integer"
            : "expected a finite number other than negative zero",
        );
    }
  if (Object.hasOwn(schema, "multipleOf")) {
    const step = schema.multipleOf;
    if (
      typeof step !== "number" ||
      !Number.isFinite(step) ||
      step <= 0 ||
      Object.is(step, -0)
    )
      invalidData(`${at}.multipleOf`, "multipleOf must be positive");
  }
  for (const [lower, upper] of BOUNDS) {
    const low = schema[lower];
    const high = schema[upper];
    if (typeof low === "number" && typeof high === "number" && low > high)
      invalidData(`${at}.${lower}`, "lower bound exceeds upper bound");
  }
}

function checkChoices(value: unknown, at: string): void {
  if (!Array.isArray(value) || !value.length)
    invalidData(`${at}.oneOf`, "oneOf needs at least one constant");
  value.forEach((member: unknown, index) => {
    const location = `${at}.oneOf[${index}]`;
    if (!record(member))
      invalidData(location, "oneOf members must be constant objects");
    const keys = plainKeys(member, location);
    if (
      !keys.includes("const") ||
      !isPrimitive(member.const) ||
      keys.some((key) => key !== "const" && key !== "title") ||
      (Object.hasOwn(member, "title") && typeof member.title !== "string")
    )
      invalidData(location, "oneOf members allow only const and title");
  });
}
