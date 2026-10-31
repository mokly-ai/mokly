/** The native control of one prop field, for each kind of control. */

/** The kind of a prop field's control, with what that kind needs. */
export type PropFieldControl =
  | { kind: "text" }
  | {
      kind: "number";
      /** The HTML bounds and step of the number field. */
      min?: number;
      max?: number;
      step: number | "any";
    }
  | { kind: "boolean" }
  | {
      kind: "select";
      /** The visible label of each choice; a choice's value is its index. */
      options: readonly string[];
      /** The label of the empty choice, such as "Choose a value". */
      placeholder: string;
    };

/** The HTML bounds of a number field, in the order that the shell writes. */
function numberBounds(control: Extract<PropFieldControl, { kind: "number" }>) {
  return {
    ...(control.min === undefined ? {} : { min: control.min }),
    ...(control.max === undefined ? {} : { max: control.max }),
    step: control.step,
  };
}

/**
 * The control: a select, a check box, or a text or number field. An optional
 * check box that the field's label column does not name carries the field's
 * label beside it. The control hides while the prop is not supplied.
 */
export function PropInput({
  control,
  describedBy,
  disabled,
  id,
  invalid,
  label,
  name,
  onChange,
  supplied,
  value,
}: {
  control: PropFieldControl;
  /** The id of the visible help or error that describes the control. */
  describedBy: string | undefined;
  disabled: boolean;
  id: string;
  invalid: boolean;
  /** The visible name of a check box that the field's label does not name. */
  label?: string | undefined;
  name: string;
  onChange: (value: boolean | string, immediate: boolean) => void;
  supplied: boolean;
  value: boolean | string;
}) {
  const accessibility = {
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    "data-prop-control": name,
    disabled,
    hidden: !supplied,
    id,
  };
  if (control.kind === "select")
    return (
      <select
        {...accessibility}
        className="mbk-reset"
        onChange={(event) => onChange(event.currentTarget.value, true)}
        value={String(value)}
      >
        <option className="mbk-reset" value="">
          {control.placeholder}
        </option>
        {control.options.map((option, index) => (
          <option className="mbk-reset" key={index} value={index}>
            {option}
          </option>
        ))}
      </select>
    );
  if (control.kind === "boolean") {
    const box = (
      <input
        {...accessibility}
        checked={value === true}
        className="mbk-reset"
        onChange={(event) => onChange(event.currentTarget.checked, true)}
        type="checkbox"
      />
    );
    return label === undefined ? (
      box
    ) : (
      <label className="mbk-control-check mbk-reset" hidden={!supplied}>
        {box}
        <span className="mbk-reset">{label}</span>
      </label>
    );
  }
  return (
    <input
      {...accessibility}
      {...(control.kind === "number"
        ? {
            inputMode: "decimal" as const,
            ...numberBounds(control),
            type: "number",
          }
        : { type: "text" })}
      className="mbk-reset"
      onChange={(event) => onChange(event.currentTarget.value, false)}
      value={String(value)}
    />
  );
}
