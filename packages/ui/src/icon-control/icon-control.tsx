/**
 * The 34px icon controls of the workspace: a button drawn as one glyph, and a
 * native select laid transparent over a glyph and a down chevron. The view
 * controls draw both, and the inspector's tabs share the button's look, so
 * one stylesheet styles them all.
 */

import type { ReactNode } from "react";

import { ChevronDownIcon } from "../icons/icons.js";
import type { DataAttribute } from "../segmented-control/segmented-control.js";

/** One choice of an icon select: its value and its visible label. */
export type IconSelectOption<Value extends string> = readonly [
  value: Value,
  label: string,
];

/** The empty data attribute that names a control, when there is one. */
function dataMark(mark: DataAttribute | undefined) {
  return mark === undefined ? {} : { [mark]: "" };
}

/**
 * A button drawn as a glyph, such as a toggle. `label` is its accessible name
 * and `title` its tooltip.
 */
export function IconButton({
  children,
  describedBy,
  description,
  disabled,
  label,
  mark,
  onClick,
  pressed,
  title,
}: {
  /** The glyph, and the change mark of a control that carries one. */
  children: ReactNode;
  /** The id of the element that describes the button, such as a mark's wording. */
  describedBy?: string | undefined;
  /** The description of the button, such as why it is unavailable. */
  description?: string | undefined;
  disabled?: boolean | undefined;
  label: string;
  /** An empty data attribute on the button, such as `data-workspace-highlight`. */
  mark?: DataAttribute | undefined;
  /** Receives each press. */
  onClick?: (() => void) | undefined;
  /** The pressed state of a toggle. Without it, the button is no toggle. */
  pressed?: boolean | undefined;
  title: string;
}) {
  return (
    <button
      type="button"
      className="mbk-icon-button"
      aria-label={label}
      aria-describedby={describedBy}
      aria-description={description}
      aria-pressed={pressed}
      title={title}
      {...dataMark(mark)}
      disabled={disabled}
      onClick={() => onClick?.()}
    >
      {children}
    </button>
  );
}

/**
 * A native select laid transparent over a glyph and the down chevron of a
 * select. `label` is the select's accessible name and `title` the tooltip of
 * the control.
 */
export function IconSelect<Value extends string>({
  children,
  describedBy,
  glyph,
  label,
  mark,
  onChange,
  options,
  title,
  value,
}: {
  /** The content after the select, such as a change mark. */
  children?: ReactNode;
  /** The id of the element that describes the select, such as a mark's wording. */
  describedBy?: string | undefined;
  /** The glyph on the face of the control. */
  glyph: ReactNode;
  label: string;
  /** An empty data attribute on the select, such as `data-workspace-viewport`. */
  mark?: DataAttribute | undefined;
  /** Receives each value that the reader chooses. */
  onChange?: ((value: Value) => void) | undefined;
  options: readonly IconSelectOption<Value>[];
  title: string;
  /** The chosen value. */
  value: Value;
}) {
  return (
    <label className="mbk-icon-select" title={title}>
      {glyph}
      <ChevronDownIcon size={18} />
      <select
        aria-describedby={describedBy}
        aria-label={label}
        {...dataMark(mark)}
        onChange={(event) => {
          const choice = options.find(
            ([option]) => option === event.currentTarget.value,
          );
          if (choice) onChange?.(choice[0]);
        }}
        value={value}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
      {children}
    </label>
  );
}
