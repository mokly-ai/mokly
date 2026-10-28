/** Pure draft and validation rules of the Props controls. */

import type { EntryDetailV3 } from "../catalogue/types.js";
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

import { CONTROLS_COPY } from "./component_controls_copy.js";
import {
  effectiveNumberControl,
  numberInputBounds,
} from "./control_numbers.js";

/** The shown entry whose props the controls edit: an entry's own or merged props. */
export interface ControlTarget {
  path: string;
  /** The shown entry's own title, which the panel and its Reset name. */
  title: string;
  kind: "screen" | "component";
  propSchema: PropSchema;
  props: ComponentWireProps;
  controls: Readonly<Record<string, ComponentControl>>;
  controlOrder?: Readonly<NonNullable<EntryDetailV3["controlOrder"]>>;
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

/** Controls in the declaration order supplied by the entry detail. */
export function controlEntries(
  target: Pick<ControlTarget, "controls" | "controlOrder">,
): (readonly [string, ComponentControl])[] {
  return (target.controlOrder ?? Object.keys(target.controls)).map(
    (key) => [key, target.controls[key]!] as const,
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
 * own bounds, including the zero-based step, without generating code. The
 * draft is merged into a fresh copy of the decoded saved props, so the props
 * without a control get the same whole-set validation.
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
      errors[key] = fieldError(target, key, control, field);
    }
  }
  if (!Object.keys(errors).length)
    try {
      validateProps(target.propSchema, merged, target.path);
    } catch {
      return { errors: { [WHOLE_PROPS_ERROR]: CONTROLS_COPY.invalidTogether } };
    }
  return {
    errors,
    ...(Object.keys(errors).length ? {} : { overrides }),
  };
}

/**
 * A field's error names what a valid value looks like. A value inside the
 * range of a step-1 field that is not whole asks for a whole number.
 */
function fieldError(
  target: ControlTarget,
  key: string,
  control: ComponentControl,
  field: ControlDraftField,
): string {
  if (control.kind === "select") return CONTROLS_COPY.chooseAvailable;
  const property = propertySchema(target.propSchema, key);
  if (control.kind !== "number")
    return CONTROLS_COPY.textError(
      property?.minLength,
      (control.kind === "text" ? control.maxLength : undefined) ??
        property?.maxLength,
    );
  const number = effectiveNumberControl(target, key, control);
  const { min, max } = numberInputBounds(number);
  const value = Number(field.value);
  const inside =
    String(field.value).trim() !== "" &&
    Number.isFinite(value) &&
    (min === undefined || value >= min) &&
    (max === undefined || value <= max);
  return inside && number.step === 1 && !Number.isInteger(value)
    ? CONTROLS_COPY.wholeNumberError(min, max)
    : CONTROLS_COPY.numberError(min, max, number.step);
}

function fieldValue(
  control: ComponentControl,
  field: ControlDraftField,
): PropPrimitive {
  if (control.kind === "boolean") return field.value === true;
  if (control.kind === "select") {
    const option =
      field.value === "" ? undefined : control.options[Number(field.value)];
    if (!option) throw new Error("no available option");
    return option.value;
  }
  if (control.kind === "number") {
    const value = Number(field.value);
    if (!String(field.value).trim() || !Number.isFinite(value))
      throw new Error("not a finite number");
    return value;
  }
  return String(field.value);
}

/** The entry the Props controls edit: the shown component row, or the screen. */
export function controlTarget(
  entry: ManifestEntry,
  row: { value: ManifestComponent; removed: boolean } | undefined,
  removed: boolean,
  controlOrder?: ControlTarget["controlOrder"],
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
          ...(controlOrder ? { controlOrder } : {}),
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
    ...(controlOrder ? { controlOrder } : {}),
    suppliedSlots: [],
    removed,
  };
}
