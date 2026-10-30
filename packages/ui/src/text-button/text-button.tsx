/**
 * A button drawn as text in the accent colour, such as Try again or Switch to
 * Current. The props and controls panels and the usage list draw it.
 */

import type { ReactNode } from "react";

export function TextButton({
  children,
  onClick,
}: {
  /** The button's text. */
  children: ReactNode;
  /** Receives each press. */
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      className="mbk-text-button mbk-reset"
      onClick={() => onClick?.()}
      type="button"
    >
      {children}
    </button>
  );
}
