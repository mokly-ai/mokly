/** Pure draft, validation and number-step rules of the Props controls. */

import { decodeProps } from "../components/codec.js";
import type { ComponentControl } from "../components/control_types.js";
import { validateControlledValues } from "../components/controls.js";
import type { ManifestComponent } from "../components/manifest_types.js";
import {
  isMultipleOf,
  validateProfileValue,
} from "../components/profile_value.js";
import type {
  ComponentWireProps,
  PropPrimitive,
  PropSchema,
} from "../components/prop_types.js";
import { propertySchema, validateProps } from "../components/props.js";
import type { ComponentOverride } from "../components/render_types.js";
import type { ManifestEntry } from "../registry/types.js";

/** The shown entry whose props the controls edit: an entry's own or merged props. */
export interface ControlTarget {
  path: string;
  /** The shown entry's own title, which the panel and its Reset name. */
  title: string;
  kind: "screen" | "component";
  propSchema: PropSchema;
  props: ComponentWireProps;
  controls: Readonly<Record<string, ComponentControl>>;
  suppliedSlots: readonly string[];
  removed: boolean;
}

/** Input representation that preserves partial numeric and text edits. */
export interface ControlDraftField {
  supplied: boolean;
  value: boolean | string;
}

/** Draft values keyed by declared controlled prop. */
export type ControlDraft = Readonly<Record<string, ControlDraftField>>;

/** The error key of props whose values are not valid together. */
export const WHOLE_PROPS_ERROR = "";

/** Validated overrides and field-specific product errors. */
export interface ValidatedControlDraft {
  errors: Readonly<Record<string, string>>;
  overrides?: Readonly<Record<string, ComponentOverride>>;
}

/** Controls in a stable order by prop name. */
export function controlEntries(
  target: Pick<ControlTarget, "controls">,
): (readonly [string, ComponentControl])[] {
  return Object.entries(target.controls).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

/** Build a fresh form state from the shown entry's saved props. */
export function controlDraft(target: ControlTarget): ControlDraft {
  const values = decodeProps(target.props);
  return Object.fromEntries(
    controlEntries(target).map(([key, control]) => {
      const value = values[key];
      const field: ControlDraftField = {
        supplied: value !== undefined,
        value:
          control.kind === "boolean"
            ? value === true
            : control.kind === "select"
              ? String(
                  control.options.findIndex((option) =>
                    Object.is(option.value, value),
                  ),
                ).replace(/^-1$/, "")
              : value === undefined
                ? ""
                : Object.is(value, -0)
                  ? "-0"
                  : String(value),
      };
      return [key, field];
    }),
  );
}

/**
 * Validate the complete draft with the profile validator and the controls'
 * own bounds, including the zero-based step, without generating code.
 */
export function validateControlDraft(
  target: ControlTarget,
  draft: ControlDraft,
): ValidatedControlDraft {
  const saved = decodeProps(target.props);
  const merged: Record<string, unknown> = { ...saved };
  const overrides: Record<string, ComponentOverride> = {};
  const errors: Record<string, string> = {};
  for (const [key, control] of controlEntries(target)) {
    const field = draft[key]!;
    if (!field.supplied) {
      delete merged[key];
      if (saved[key] !== undefined) overrides[key] = { kind: "unset" };
      continue;
    }
    try {
      const value = fieldValue(control, field);
      const property = propertySchema(target.propSchema, key);
      if (!property) throw new Error("undeclared prop");
      validateProfileValue(property, value, key);
      validateControlledValues({ [key]: control }, { [key]: value }, key);
      if (
        control.kind === "number" &&
        control.step !== undefined &&
        !isMultipleOf(value as number, control.step)
      )
        throw new Error("off step");
      merged[key] = value;
      if (!Object.is(value, saved[key]))
        overrides[key] = { kind: "set", value };
    } catch {
      errors[key] =
        control.kind === "number"
          ? "Enter a number within the allowed range."
          : control.kind === "select"
            ? "Choose an available value."
            : "Check this value and its allowed limits.";
    }
  }
  if (!Object.keys(errors).length)
    try {
      validateProps(target.propSchema, merged, target.path);
    } catch {
      return {
        errors: { [WHOLE_PROPS_ERROR]: "These values are not valid together." },
      };
    }
  return {
    errors,
    ...(Object.keys(errors).length ? {} : { overrides }),
  };
}

/**
 * The HTML bounds that offer only multiples of the step counted from zero:
 * the first offered value is the smallest multiple at or above the minimum.
 */
export function numberInputBounds(
  control: Extract<ComponentControl, { kind: "number" }>,
): { min?: number; max?: number; step: number | "any" } {
  const step = control.step;
  if (step === undefined)
    return {
      ...(control.minimum === undefined ? {} : { min: control.minimum }),
      ...(control.maximum === undefined ? {} : { max: control.maximum }),
      step: "any",
    };
  return {
    ...(control.minimum === undefined
      ? {}
      : { min: multiple(control.minimum, step, "up") }),
    ...(control.maximum === undefined
      ? {}
      : { max: multiple(control.maximum, step, "down") }),
    step,
  };
}

function fieldValue(
  control: ComponentControl,
  field: ControlDraftField,
): PropPrimitive {
  if (control.kind === "boolean") return field.value === true;
  if (control.kind === "select") {
    const option =
      field.value === "" ? undefined : control.options[Number(field.value)];
    if (!option) throw new Error("Choose an available value.");
    return option.value;
  }
  if (control.kind === "number") {
    const value = Number(field.value);
    if (!String(field.value).trim() || !Number.isFinite(value))
      throw new Error("Enter a finite number.");
    return value;
  }
  return String(field.value);
}

/** The nearest multiple of `step` at or beyond `bound` in one direction. */
function multiple(bound: number, step: number, direction: "up" | "down") {
  const decimals = Math.min(20, Math.max(precision(step), precision(bound)));
  const at = (count: number) => Number((count * step).toFixed(decimals));
  let count =
    direction === "up" ? Math.ceil(bound / step) : Math.floor(bound / step);
  if (direction === "up") {
    if (at(count) < bound) count += 1;
    else if (at(count - 1) >= bound) count -= 1;
  } else if (at(count) > bound) count -= 1;
  else if (at(count + 1) <= bound) count += 1;
  const value = at(count);
  return Object.is(value, -0) ? 0 : value;
}

function precision(value: number): number {
  const [mantissa = "", exponent = "0"] = String(value).split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent));
}

/** The entry the Props controls edit: the shown component row, or the screen. */
export function controlTarget(
  entry: ManifestEntry,
  row: { value: ManifestComponent; removed: boolean } | undefined,
  removed: boolean,
): ControlTarget | undefined {
  if (entry.kind === "component")
    return row
      ? {
          path: row.value.path,
          title: row.value.title,
          kind: "component",
          propSchema: row.value.propSchema,
          props: row.value.props,
          controls: row.value.controls,
          suppliedSlots: row.value.suppliedSlots,
          removed: row.removed,
        }
      : undefined;
  if (entry.kind !== "screen" || !entry.propSchema) return undefined;
  return {
    path: entry.path,
    title: entry.title,
    kind: "screen",
    propSchema: entry.propSchema,
    props: entry.props ?? {},
    controls: entry.controls ?? {},
    suppliedSlots: [],
    removed,
  };
}
