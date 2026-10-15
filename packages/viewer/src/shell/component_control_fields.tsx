/** Declarative prop controls with explicit optional supply and field errors. */

import type { ComponentControl } from "../components/control_types.js";
import { optionalProperty } from "../components/props.js";

import {
  controlEntries,
  numberInputBounds,
  type ControlDraft,
  type ControlDraftField,
  type ControlTarget,
} from "./control_values.js";
import { useShellIdentifierScope } from "./identifier_context.js";

export {
  controlDraft,
  validateControlDraft,
  type ControlDraft,
  type ControlDraftField,
  type ControlTarget,
  type ValidatedControlDraft,
} from "./control_values.js";

/** Native form fields for every control of the shown entry. */
export function ComponentControlFields({
  disabled,
  draft,
  errors,
  onChange,
  target,
}: {
  disabled: boolean;
  draft: ControlDraft;
  errors: Readonly<Record<string, string>>;
  onChange(key: string, field: ControlDraftField, immediate: boolean): void;
  target: ControlTarget;
}) {
  const identifier = useShellIdentifierScope();
  return (
    <div className="mbk-control-grid">
      {controlEntries(target).map(([key, control]) => {
        const field = draft[key]!;
        const label =
          control.label ?? target.propSchema.properties?.[key]?.title ?? key;
        const optional = optionalProperty(target.propSchema, key);
        const id = identifier(`mb-prop-${target.path}-${key}`);
        const help =
          control.description ??
          target.propSchema.properties?.[key]?.description ??
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

function ControlInput({
  control,
  disabled,
  field,
  id,
  invalid,
  name,
  onChange,
}: {
  control: ComponentControl;
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
            ...numberInputBounds(control),
            type: "number",
          }
        : { type: "text" })}
      onChange={(event) => onChange(event.currentTarget.value, false)}
      value={String(field.value)}
    />
  );
}
