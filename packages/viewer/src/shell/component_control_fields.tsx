/** Declarative prop controls with explicit optional supply and field errors. */

import type { ComponentControl } from "../components/control_types.js";
import { optionalProperty } from "../components/props.js";

import { CONTROLS_COPY } from "./component_controls_copy.js";
import {
  effectiveNumberControl,
  numberInputBounds,
} from "./control_numbers.js";
import {
  controlEntries,
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
        const shown =
          control.kind === "number"
            ? effectiveNumberControl(target, key, control)
            : control;
        const bounds =
          shown.kind === "number" ? numberInputBounds(shown) : undefined;
        const help =
          control.description ??
          target.propSchema.properties?.[key]?.description ??
          (shown.kind === "number"
            ? CONTROLS_COPY.range(bounds?.min, bounds?.max, shown.step)
            : "");
        const error = errors[key];
        // An optional toggle's value check box carries the field's name.
        const named = control.kind === "boolean" && optional;
        const name = (
          <>
            {label}
            {optional ? (
              <>
                {" "}
                <span aria-hidden="true" className="mbk-control-optional">
                  {CONTROLS_COPY.optional}
                </span>
              </>
            ) : null}
          </>
        );
        return (
          <div className="mbk-control-field" key={key}>
            {named ? (
              <span className="mbk-control-name">{name}</span>
            ) : (
              <label htmlFor={id}>{name}</label>
            )}
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
              control={shown}
              describedBy={
                error !== undefined
                  ? `${id}-error`
                  : help
                    ? `${id}-help`
                    : undefined
              }
              disabled={disabled}
              field={field}
              id={id}
              invalid={error !== undefined}
              {...(named ? { label } : {})}
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
  describedBy,
  disabled,
  field,
  id,
  invalid,
  label,
  name,
  onChange,
}: {
  control: ComponentControl;
  /** The visible help or error that describes the field. */
  describedBy: string | undefined;
  disabled: boolean;
  field: ControlDraftField;
  id: string;
  invalid: boolean;
  /** The visible name of a check box that the field's heading does not label. */
  label?: string;
  name: string;
  onChange(value: boolean | string, immediate: boolean): void;
}) {
  const accessibility = {
    "aria-describedby": describedBy,
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
        <option value="">{CONTROLS_COPY.chooseValue}</option>
        {control.options.map((option, index) => (
          <option key={index} value={index}>
            {option.label}
          </option>
        ))}
      </select>
    );
  if (control.kind === "boolean") {
    const box = (
      <input
        {...accessibility}
        checked={field.value === true}
        onChange={(event) => onChange(event.currentTarget.checked, true)}
        type="checkbox"
      />
    );
    return label === undefined ? (
      box
    ) : (
      <label className="mbk-control-check" hidden={!field.supplied}>
        {box}
        <span>{label}</span>
      </label>
    );
  }
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
