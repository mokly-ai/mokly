/**
 * A button drawn as text in the accent colour, such as Try again or Switch to
 * Current. The props and controls panels and the usage list draw it. A static
 * depiction that runs no script draws it as a link to an address instead.
 */

import type { ReactNode } from "react";

export function TextButton({
  children,
  href,
  onClick,
}: {
  /** The button's text. */
  children: ReactNode;
  /**
   * The address that a static depiction opens instead, such as another
   * document that shows what the button does. The button is then a link.
   */
  href?: string | undefined;
  /** Receives each press. */
  onClick?: (() => void) | undefined;
}) {
  if (href !== undefined)
    return (
      <a className="mbk-text-button" href={href}>
        {children}
      </a>
    );
  return (
    <button
      className="mbk-text-button"
      onClick={() => onClick?.()}
      type="button"
    >
      {children}
    </button>
  );
}
