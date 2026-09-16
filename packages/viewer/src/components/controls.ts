import type { ComponentControl } from "./control_types.js";
import { assertPlainData, exactKeys, invalidData, plainKeys } from "./data.js";
import type {
  ComponentPropsData,
  DataPropSchema,
  ObjectPropSchema,
} from "./prop_types.js";
import { validateValue } from "./props.js";
import { bounds } from "./schema.js";

/** Controls narrow declared fields; they never infer a second prop schema. */
export function validateControls(
  schema: ObjectPropSchema,
  controls: unknown,
  context = "Component",
): asserts controls is Readonly<Record<string, ComponentControl>> {
  const at = `${context} $controls`;
  assertPlainData(controls, at, true);
  for (const key of plainKeys(controls, at)) {
    const field = schema.properties[key];
    if (!field)
      invalidData(`${at}.${key}`, "control requires a declared data prop");
    const control = (controls as Record<string, unknown>)[key];
    plainKeys(control, `${at}.${key}`);
    const item = control as Record<string, unknown>;
    const common = ["kind", "label", "description"];
    for (const label of ["label", "description"])
      if (
        item[label] !== undefined &&
        (typeof item[label] !== "string" || !item[label].trim())
      )
        invalidData(`${at}.${key}.${label}`, "expected nonempty text");
    switch (item.kind) {
      case "text":
        exactKeys(item, [...common, "maxLength"], at);
        bounds(item, "maxLength", "maxLength", at, true);
        if (!primitiveSchema(field.schema, "string"))
          invalidData(`${at}.${key}`, "text control requires string data");
        break;
      case "boolean":
        exactKeys(item, common, at);
        if (!primitiveSchema(field.schema, "boolean"))
          invalidData(`${at}.${key}`, "boolean control requires boolean data");
        break;
      case "number":
        exactKeys(item, [...common, "minimum", "maximum", "step"], at);
        bounds(item, "minimum", "maximum", at, false);
        if (!primitiveSchema(field.schema, "number"))
          invalidData(`${at}.${key}`, "number control requires numeric data");
        if (
          item.step !== undefined &&
          (typeof item.step !== "number" ||
            !Number.isFinite(item.step) ||
            item.step <= 0)
        )
          invalidData(`${at}.${key}.step`, "expected a positive finite step");
        break;
      case "select":
        exactKeys(item, [...common, "options"], at);
        if (!Array.isArray(item.options) || !item.options.length)
          invalidData(`${at}.${key}.options`, "expected nonempty options");
        for (const [index, option] of item.options.entries()) {
          exactKeys(option, ["label", "value"], at);
          if (typeof option.label !== "string" || !option.label.trim())
            invalidData(at, "option requires a label");
          const value = option.value;
          if (!(
            value === null ||
            typeof value === "string" ||
            typeof value === "boolean" ||
            (typeof value === "number" &&
              Number.isFinite(value) &&
              !Object.is(value, -0))
          ))
            invalidData(at, "option requires a lossless primitive value");
          validateValue(field.schema, value, `${at}.${key}.options[${index}]`);
          if (
            item.options
              .slice(0, index)
              .some((other) => Object.is(other.value, value))
          )
            invalidData(at, "duplicate option value");
        }
        break;
      default:
        invalidData(`${at}.${key}.kind`, "unknown control kind");
    }
  }
}

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
        value.length > (control.maxLength ?? Infinity))
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

function primitiveSchema(
  schema: DataPropSchema,
  kind: "string" | "number" | "boolean",
): boolean {
  if (schema.kind === "enum")
    return schema.values.every((value) => typeof value === kind);
  if (schema.kind === "union")
    return schema.anyOf.every((member) => primitiveSchema(member, kind));
  return schema.kind === kind;
}
