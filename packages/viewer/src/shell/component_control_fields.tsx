/** Declarative prop controls with explicit optional supply and field errors. */

import { decodeProps, encodeValue } from "../components/codec.js";
import { validateControlledValues } from "../components/controls.js";
import type { ManifestComponent } from "../components/manifest_types.js";
import type {
  ComponentWirePrimitive,
  PropPrimitive,
} from "../components/prop_types.js";
import { validateValue } from "../components/props.js";
import type { ComponentOverride } from "../components/render_types.js";

import type { WorkspaceVariant } from "./workspace_data.js";

/** Input representation that preserves partial numeric and text edits. */
export interface ControlDraftField {
  supplied: boolean;
  value: boolean | string;
}

/** Draft values keyed by declared controlled prop. */
export type ControlDraft = Readonly<Record<string, ControlDraftField>>;

/** Validated overrides and field-specific product errors. */
export interface ValidatedControlDraft {
  errors: Readonly<Record<string, string>>;
  overrides?: Readonly<Record<string, ComponentOverride>>;
}

/** Build a fresh form state from one saved variant. */
export function controlDraft(
  component: ManifestComponent,
  variant: WorkspaceVariant,
): ControlDraft {
  const values = decodeProps(variant.value.props);
  return Object.fromEntries(
    controlEntries(component).map(([key, control]) => {
      const value = values[key];
      const field: ControlDraftField = {
        supplied: value !== undefined,
        value:
          control.kind === "boolean"
            ? value === true
            : control.kind === "select"
              ? (() => {
                  const selected = control.options.findIndex((option) =>
                    Object.is(option.value, value),
                  );
                  return selected < 0 ? "" : String(selected);
                })()
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

/** Validate the complete draft without replacing the last valid preview. */
export function validateControlDraft(
  component: ManifestComponent,
  variant: WorkspaceVariant,
  draft: ControlDraft,
): ValidatedControlDraft {
  const saved = decodeProps(variant.value.props);
  const overrides: Record<string, ComponentOverride> = {};
  const errors: Record<string, string> = {};
  for (const [key, control] of controlEntries(component)) {
    const field = draft[key]!;
    if (!field.supplied) {
      if (saved[key] !== undefined) overrides[key] = { kind: "unset" };
      continue;
    }
    try {
      let value: PropPrimitive;
      if (control.kind === "boolean") value = field.value === true;
      else if (control.kind === "select") {
        if (field.value === "") throw new Error("Choose an available value.");
        const option = control.options[Number(field.value)];
        if (!option) throw new Error("Choose an available value.");
        value = option.value;
      } else if (control.kind === "number") {
        value = Number(field.value);
        if (!String(field.value).trim() || !Number.isFinite(value))
          throw new Error("Enter a finite number.");
      } else value = String(field.value);
      validateValue(component.propSchema.properties[key]!.schema, value, key);
      validateControlledValues({ [key]: control }, { [key]: value }, key);
      if (!Object.is(value, saved[key]))
        overrides[key] = {
          kind: "set",
          value: encodeValue(value) as ComponentWirePrimitive,
        };
    } catch {
      errors[key] =
        control.kind === "number"
          ? "Enter a number within the allowed range."
          : control.kind === "select"
            ? "Choose an available value."
            : "Check this value and its allowed limits.";
    }
  }
  return {
    errors,
    ...(Object.keys(errors).length ? {} : { overrides }),
  };
}

/** Native form fields for all author-declared controls. */
export function ComponentControlFields({
  component,
  disabled,
  draft,
  errors,
  onChange,
}: {
  component: ManifestComponent;
  disabled: boolean;
  draft: ControlDraft;
  errors: Readonly<Record<string, string>>;
  onChange(key: string, field: ControlDraftField, immediate: boolean): void;
}) {
  return (
    <div className="mbk-control-grid">
      {controlEntries(component).map(([key, control]) => {
        const field = draft[key]!;
        const label = control.label ?? key;
        const optional = component.propSchema.properties[key]?.optional;
        const id = `mb-prop-${component.id}-${key}`;
        const help =
          control.description ??
          (control.kind === "number" &&
          (control.minimum !== undefined || control.maximum !== undefined)
            ? `Allowed range: ${control.minimum ?? "no minimum"} to ${control.maximum ?? "no maximum"}.`
            : "");
        return (
          <div className="mbk-control-field" key={key}>
            {optional ? (
              <label className="mbk-control-supplied">
                <input
                  aria-label={`Supply ${label}`}
                  checked={field.supplied}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      key,
                      { ...field, supplied: event.currentTarget.checked },
                      true,
                    )
                  }
                  type="checkbox"
                />
                <span>Supplied</span>
              </label>
            ) : null}
            <label htmlFor={id}>{label}</label>
            <ControlInput
              control={control}
              disabled={disabled || !field.supplied}
              field={field}
              id={id}
              invalid={errors[key] !== undefined}
              name={key}
              onChange={(value, immediate) =>
                onChange(key, { ...field, value }, immediate)
              }
            />
            <small id={`${id}-help`}>{help}</small>
            <small
              className="mbk-control-error"
              hidden={errors[key] === undefined}
              id={`${id}-error`}
            >
              {errors[key]}
            </small>
          </div>
        );
      })}
    </div>
  );
}

function controlEntries(component: ManifestComponent) {
  return Object.entries(component.controls).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function ControlInput({
  control,
  disabled,
  field,
  id,
  invalid,
  name,
  onChange,
}: {
  control: ManifestComponent["controls"][string];
  disabled: boolean;
  field: ControlDraftField;
  id: string;
  invalid: boolean;
  name: string;
  onChange(value: boolean | string, immediate: boolean): void;
}) {
  const accessibility = {
    "aria-describedby": `${id}-help ${id}-error`,
    "aria-invalid": invalid || undefined,
    "data-prop-control": name,
    disabled,
    id,
  };
  if (control.kind === "select")
    return (
      <select
        {...accessibility}
        onChange={(event) => onChange(event.currentTarget.value, true)}
        value={String(field.value)}
      >
        <option value="">Choose a value</option>
        {control.options.map((option, index) => (
          <option key={index} value={index}>
            {option.label}
          </option>
        ))}
      </select>
    );
  if (control.kind === "boolean")
    return (
      <input
        {...accessibility}
        checked={field.value === true}
        onChange={(event) => onChange(event.currentTarget.checked, true)}
        type="checkbox"
      />
    );
  return (
    <input
      {...accessibility}
      {...(control.kind === "number"
        ? {
            inputMode: "decimal" as const,
            max: control.maximum,
            min: control.minimum,
            step: control.step ?? "any",
            type: "number",
          }
        : { maxLength: control.maxLength, type: "text" })}
      onChange={(event) => onChange(event.currentTarget.value, false)}
      value={String(field.value)}
    />
  );
}
