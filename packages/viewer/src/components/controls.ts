import type { PropSchema } from "../generated/catalogue/PropSchema.js";

import type { ComponentControl } from "./control_types.js";
import { assertPlainData, exactKeys, invalidData, plainKeys } from "./data.js";
import { isPrimitive, schemaTypes } from "./profile_schema.js";
import { profileAccepts } from "./profile_value.js";
import type { ComponentPropsData } from "./prop_types.js";
import { propertySchema } from "./props.js";

const COMMON = ["kind", "label", "description"];

/** Controls narrow declared properties; they never infer a second prop schema. */
export function validateControls(
  schema: PropSchema,
  controls: unknown,
  context = "Component",
): asserts controls is Readonly<Record<string, ComponentControl>> {
  const at = `${context} $controls`;
  assertPlainData(controls, at);
  for (const key of plainKeys(controls, at)) {
    const property = propertySchema(schema, key);
    if (!property)
      invalidData(`${at}.${key}`, "control requires a declared data prop");
    const control = (controls as Record<string, unknown>)[key];
    validateControl(control, property, `${at}.${key}`);
  }
}

function validateControl(
  control: unknown,
  property: PropSchema,
  at: string,
): void {
  const item = control as Record<string, unknown>;
  plainKeys(item, at);
  for (const label of ["label", "description"])
    if (
      item[label] !== undefined &&
      (typeof item[label] !== "string" || !item[label].trim())
    )
      invalidData(`${at}.${label}`, "expected nonempty text");
  switch (item.kind) {
    case "text":
      exactKeys(item, [...COMMON, "maxLength"], at);
      count(item.maxLength, `${at}.maxLength`);
      if (!acceptsOnly(property, "string"))
        invalidData(at, "text control requires string data");
      break;
    case "boolean":
      exactKeys(item, COMMON, at);
      if (!acceptsOnly(property, "boolean"))
        invalidData(at, "boolean control requires boolean data");
      break;
    case "number":
      exactKeys(item, [...COMMON, "minimum", "maximum", "step"], at);
      for (const bound of ["minimum", "maximum"]) finite(item[bound], at);
      if (
        typeof item.minimum === "number" &&
        typeof item.maximum === "number" &&
        item.minimum > item.maximum
      )
        invalidData(at, "lower bound exceeds upper bound");
      if (
        item.step !== undefined &&
        (typeof item.step !== "number" ||
          !Number.isFinite(item.step) ||
          item.step <= 0)
      )
        invalidData(`${at}.step`, "expected a positive finite step");
      if (!acceptsOnly(property, "number"))
        invalidData(at, "number control requires numeric data");
      break;
    case "select":
      exactKeys(item, [...COMMON, "options"], at);
      validateOptions(item.options, property, at);
      break;
    default:
      invalidData(`${at}.kind`, "unknown control kind");
  }
}

function validateOptions(
  options: unknown,
  property: PropSchema,
  at: string,
): void {
  if (!Array.isArray(options) || !options.length)
    invalidData(`${at}.options`, "expected nonempty options");
  options.forEach((option: unknown, index) => {
    const location = `${at}.options[${index}]`;
    exactKeys(option, ["label", "value"], location);
    if (typeof option.label !== "string" || !option.label.trim())
      invalidData(location, "option requires a label");
    const value = option.value;
    if (!isPrimitive(value) || Object.is(value, -0))
      invalidData(location, "option requires a lossless primitive value");
    if (!profileAccepts(property, value))
      invalidData(location, "option value fails the property schema");
    if (
      options
        .slice(0, index)
        .some((other: { value?: unknown }) => Object.is(other.value, value))
    )
      invalidData(location, "duplicate option value");
  });
}

/**
 * Saved props must also satisfy the narrower constraints of their controls.
 * A text length counts code points, like the schema's `maxLength`.
 */
export function validateControlledValues(
  controls: Readonly<Record<string, ComponentControl>>,
  props: ComponentPropsData,
  at: string,
): void {
  for (const [key, control] of Object.entries(controls)) {
    const value = props[key];
    if (value === undefined) continue;
    if (
      control.kind === "text" &&
      (typeof value !== "string" ||
        [...value].length > (control.maxLength ?? Infinity))
    )
      invalidData(`${at}.${key}`, "text exceeds control limits");
    if (control.kind === "boolean" && typeof value !== "boolean")
      invalidData(`${at}.${key}`, "expected a boolean");
    if (
      control.kind === "number" &&
      (typeof value !== "number" ||
        value < (control.minimum ?? -Infinity) ||
        value > (control.maximum ?? Infinity))
    )
      invalidData(`${at}.${key}`, "number exceeds control limits");
    if (
      control.kind === "select" &&
      !control.options.some((option) => Object.is(option.value, value))
    )
      invalidData(`${at}.${key}`, "value is not a control option");
  }
}

/** Whether every value a schema accepts is one primitive kind, never null. */
function acceptsOnly(
  schema: PropSchema,
  kind: "string" | "number" | "boolean",
): boolean {
  if (schema.enum)
    return (
      schema.enum.length > 0 &&
      schema.enum.every((value) => typeof value === kind)
    );
  if (Object.hasOwn(schema, "const")) return typeof schema.const === kind;
  if (schema.oneOf)
    return schema.oneOf.every((choice) => typeof choice.const === kind);
  if (schema.anyOf)
    return schema.anyOf.every((member) => acceptsOnly(member, kind));
  const types = [...schemaTypes(schema)];
  const allowed = kind === "number" ? ["number", "integer"] : [kind];
  return types.length > 0 && types.every((type) => allowed.includes(type));
}

function count(value: unknown, at: string): void {
  if (
    value !== undefined &&
    (typeof value !== "number" || !Number.isInteger(value) || value < 0)
  )
    invalidData(at, "expected a nonnegative integer");
}

function finite(value: unknown, at: string): void {
  if (
    value !== undefined &&
    (typeof value !== "number" ||
      !Number.isFinite(value) ||
      Object.is(value, -0))
  )
    invalidData(at, "expected a finite number other than negative zero");
}
