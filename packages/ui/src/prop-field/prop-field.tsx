/**
 * The fields of the Props tab: one row for each control, its name in a label
 * column and then its value, its help, and its error. An optional field has a
 * check box that supplies it, and says when it is not set. The field names
 * only its visible help or error as its control's description. A static
 * depiction that runs no script frames a native control that it draws itself.
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
  return <div className="mbk-control-rows">{children}</div>;
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
  return (
    <FieldFrame
      description={description}
      disabled={disabled}
      error={error}
      id={id}
      label={label}
      named={named}
      nativeSupply={false}
      onSupply={onSupply}
      optional={optional}
      supplied={supplied}
      wording={wording}
    >
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
    </FieldFrame>
  );
}

/** What a field's frame shows around its control. */
interface FrameProps {
  /** The field's help, or empty when it has none. */
  description: string;
  disabled: boolean;
  /** Why the value is not valid. */
  error?: string | undefined;
  /** The id of the control, unique in the document. */
  id: string;
  label: string;
  /** Receives whether the reader supplies an optional field. */
  onSupply?: ((supplied: boolean) => void) | undefined;
  optional: boolean;
  /** Whether the prop has a value. */
  supplied: boolean;
  wording: PropFieldWording;
}

/**
 * One field of a static depiction, around a native control that the host
 * draws itself: an input or a select with the field's id. The control carries
 * the id of the help or the error that describes it, its invalid state, and
 * its value. The help and the error take the ids of `PropField`. A static
 * depiction runs no script, so an optional field draws both its control and
 * its Not set line under `data-native-supply`, and the package stylesheet
 * shows the one that matches the Set check box.
 */
export function PropFieldFrame({
  input,
  ...frame
}: FrameProps & {
  /** The native control. */
  input: ReactNode;
}) {
  return (
    <FieldFrame {...frame} named={false} nativeSupply>
      {input}
    </FieldFrame>
  );
}

/**
 * The frame of one field: the label column, the check box that supplies an
 * optional field, the control, the line of a field without a value, the
 * help, and the error.
 */
function FieldFrame({
  children,
  description,
  disabled,
  error,
  id,
  label,
  named,
  nativeSupply,
  onSupply,
  optional,
  supplied,
  wording,
}: FrameProps & {
  /** The control. */
  children: ReactNode;
  /** Whether the control names itself, so the label column names nothing. */
  named: boolean;
  /** Whether the Set check box alone shows the field's state, without a script. */
  nativeSupply: boolean;
}) {
  // An optional field whose Set check box shows its state without a script
  // draws both states under its marker.
  const native = nativeSupply && optional;
  const heading = (
    <>
      {label}
      {optional ? (
        <>
          {" "}
          <span aria-hidden="true" className="mbk-control-optional">
            {wording.optional}
          </span>
        </>
      ) : null}
    </>
  );
  return (
    <div
      className="mbk-control-field"
      data-native-supply={native ? "" : undefined}
    >
      {named ? (
        <span className="mbk-control-label">{heading}</span>
      ) : (
        <label className="mbk-control-label" htmlFor={id}>
          {heading}
        </label>
      )}
      <div className="mbk-control-value">
        {optional ? (
          <label className="mbk-control-set">
            <input
              checked={supplied}
              disabled={disabled}
              onChange={(event) => onSupply?.(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>{wording.set}</span>
          </label>
        ) : null}
        {children}
        {supplied && !native ? null : (
          <p className="mbk-control-unset">{wording.notSet}</p>
        )}
        <small hidden={!description || error !== undefined} id={`${id}-help`}>
          {description}
        </small>
        <small
          className="mbk-control-error"
          hidden={error === undefined}
          id={`${id}-error`}
        >
          {error}
        </small>
      </div>
    </div>
  );
}
