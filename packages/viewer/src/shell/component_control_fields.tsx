/** Declarative prop controls with explicit optional supply and field errors. */

import type { ComponentControl } from "../components/control_types.js";
import { optionalProperty } from "../components/props.js";

import { CONTROLS_COPY } from "./component_controls_copy.js";
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
        const bounds =
          control.kind === "number" ? numberInputBounds(control) : undefined;
        const help =
          control.description ??
          target.propSchema.properties?.[key]?.description ??
          (control.kind === "number"
            ? CONTROLS_COPY.range(bounds?.min, bounds?.max, control.step)
            : "");
        const error = errors[key];
        return (
          <div className="mbk-control-field" key={key}>
            <label htmlFor={id}>
              {label}
              {optional ? (
                <>
                  {" "}
                  <span aria-hidden="true">{CONTROLS_COPY.optional}</span>
                </>
              ) : null}
            </label>
            {optional ? (
              <label className="mbk-control-set">
                <input
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
                <span>{CONTROLS_COPY.set(label)}</span>
              </label>
            ) : null}
            <ControlInput
              control={control}
              disabled={disabled}
              field={field}
              id={id}
              invalid={error !== undefined}
              name={key}
              onChange={(value, immediate) =>
                onChange(key, { ...field, value }, immediate)
              }
            />
            {field.supplied ? null : (
              <p className="mbk-control-unset">{CONTROLS_COPY.notSet}</p>
            )}
            <small hidden={!help || error !== undefined} id={`${id}-help`}>
              {help}
            </small>
            <small
              className="mbk-control-error"
              hidden={error === undefined}
              id={`${id}-error`}
            >
              {error}
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
    hidden: !field.supplied,
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
