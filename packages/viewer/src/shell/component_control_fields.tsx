/**
 * Declarative prop controls with explicit optional supply and field errors.
 * This container derives each field's label, help, error, and scoped id from
 * the shown entry's controls and schema, and `@mokly/ui/prop-field` renders
 * the fields.
 */

import {
  PropField,
  PropFields,
  type PropFieldControl,
} from "@mokly/ui/prop-field";

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

/** The control of a field: its kind, a number's HTML bounds, or a select's choices. */
function fieldControl(control: ComponentControl): PropFieldControl {
  if (control.kind === "number")
    return { kind: "number", ...numberInputBounds(control) };
  if (control.kind === "select")
    return {
      kind: "select",
      options: control.options.map((option) => option.label),
      placeholder: CONTROLS_COPY.chooseValue,
    };
  return { kind: control.kind };
}

/**
 * Native form fields for every control of the shown entry, one row each: the
 * field's name in a label column, then its value, help, and error.
 */
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
    <PropFields>
      {controlEntries(target).map(([key, control]) => {
        const field = draft[key]!;
        const label =
          control.label ?? target.propSchema.properties?.[key]?.title ?? key;
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
        return (
          <PropField
            control={fieldControl(shown)}
            description={help}
            disabled={disabled}
            error={error}
            id={identifier(`mb-prop-${target.path}-${key}`)}
            key={key}
            label={label}
            name={key}
            onChange={(value, immediate) =>
              onChange(key, { ...field, value }, immediate)
            }
            onSupply={(supplied) => onChange(key, { ...field, supplied }, true)}
            optional={optionalProperty(target.propSchema, key)}
            supplied={field.supplied}
            value={field.value}
            wording={{
              notSet: CONTROLS_COPY.notSet,
              optional: CONTROLS_COPY.optional,
              set: CONTROLS_COPY.set(label),
            }}
          />
        );
      })}
    </PropFields>
  );
}
