/**
 * The 34px icon control: a button drawn as one glyph, such as a toggle.
 */

import type { ReactNode, Ref } from "react";

import type { DataAttribute } from "../data-attribute/data-attribute.js";

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
  ref,
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
  /** Receives the button, such as for a host that moves focus to it. */
  ref?: Ref<HTMLButtonElement> | undefined;
  title: string;
}) {
  return (
    <button
      type="button"
      className="mbk-icon-button mbk-reset"
      aria-label={label}
      aria-describedby={describedBy}
      aria-description={description}
      aria-pressed={pressed}
      title={title}
      {...dataMark(mark)}
      disabled={disabled}
      onClick={() => onClick?.()}
      ref={ref}
    >
      {children}
    </button>
  );
}
