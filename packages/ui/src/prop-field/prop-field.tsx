/**
 * The fields of the Props tab: one row for each control, its name in a label
 * column and then its value, its help, and its error. An optional field has a
 * check box that supplies it, and says when it is not set. The field names
 * only its visible help or error as its control's description.
 */

import type { ReactNode } from "react";

import { PropInput, type PropFieldControl } from "./prop-input.js";

export type { PropFieldControl } from "./prop-input.js";

/** The wording of one field, which the host supplies. */
export interface PropFieldWording {
  /** The mark of an optional field, such as "Optional". */
  optional: string;
  /** The label of the check box that supplies an optional field, such as "Set label". */
  set: string;
  /** The line of a field without a value, such as "Not set". */
  notSet: string;
}

/** The rows of the fields, in their order. */
export function PropFields({ children }: { children?: ReactNode }) {
  return <div className="mbk-control-rows mbk-reset">{children}</div>;
}

/**
 * One field. Its help has the id `{id}-help` and its error `{id}-error`. A
 * field shows its help while it has no error.
 */
export function PropField({
  control,
  description,
  disabled,
  error,
  id,
  label,
  name,
  onChange,
  onSupply,
  optional,
  supplied,
  value,
  wording,
}: {
  control: PropFieldControl;
  /** The field's help, or empty when it has none. */
  description: string;
  disabled: boolean;
  /** Why the value is not valid. */
  error?: string | undefined;
  /** The id of the control, unique in the document. */
  id: string;
  label: string;
  /** The prop's name, which the control carries in `data-prop-control`. */
  name: string;
  /**
   * Receives each value that the reader enters, and whether to apply it at
   * once, as a select or a check box asks, or after the typing settles.
   */
  onChange?:
    ((value: boolean | string, immediate: boolean) => void) | undefined;
  /** Receives whether the reader supplies an optional field. */
  onSupply?: ((supplied: boolean) => void) | undefined;
  optional: boolean;
  /** Whether the prop has a value, which shows the control. */
  supplied: boolean;
  value: boolean | string;
  wording: PropFieldWording;
}) {
  // An optional toggle's value check box carries the field's name.
  const named = control.kind === "boolean" && optional;
  const heading = (
    <>
      {label}
      {optional ? (
        <>
          {" "}
          <span aria-hidden="true" className="mbk-control-optional mbk-reset">
            {wording.optional}
          </span>
        </>
      ) : null}
    </>
  );
  return (
    <div className="mbk-control-field mbk-reset">
      {named ? (
        <span className="mbk-control-label mbk-reset">{heading}</span>
      ) : (
        <label className="mbk-control-label mbk-reset" htmlFor={id}>
          {heading}
        </label>
      )}
      <div className="mbk-control-value mbk-reset">
        {optional ? (
          <label className="mbk-control-set mbk-reset">
            <input
              checked={supplied}
              className="mbk-reset"
              disabled={disabled}
              onChange={(event) => onSupply?.(event.currentTarget.checked)}
              type="checkbox"
            />
            <span className="mbk-reset">{wording.set}</span>
          </label>
        ) : null}
        <PropInput
          control={control}
          describedBy={
            error !== undefined
              ? `${id}-error`
              : description
                ? `${id}-help`
                : undefined
          }
          disabled={disabled}
          id={id}
          invalid={error !== undefined}
          {...(named ? { label } : {})}
          name={name}
          onChange={(next, immediate) => onChange?.(next, immediate)}
          supplied={supplied}
          value={value}
        />
        {supplied ? null : (
          <p className="mbk-control-unset mbk-reset">{wording.notSet}</p>
        )}
        <small
          className="mbk-reset"
          hidden={!description || error !== undefined}
          id={`${id}-help`}
        >
          {description}
        </small>
        <small
          className="mbk-control-error mbk-reset"
          hidden={error === undefined}
          id={`${id}-error`}
        >
          {error}
        </small>
      </div>
    </div>
  );
}
