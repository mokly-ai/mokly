import type { CSSProperties, ReactNode } from "react";

/** No box of its own, so the frame inside stays a child of the parent's layout. */
const boxless: CSSProperties = { display: "contents" };

/**
 * A layer beneath an open layer: the page beneath the settings dialog, the
 * settings frame beneath a confirmation modal, or the viewer beneath an open
 * panel. It stays drawn, but none of its controls takes focus and assistive
 * technology skips it, as in the live app. `inert` and `aria-hidden` always
 * come together here, so no screen sets one without the other.
 *
 * With a `className` the layer is that drawn element, such as a backdrop.
 * Without one it draws no box of its own and only holds a registered frame,
 * whose closed prop schema takes neither attribute, so the frame keeps its
 * place in its parent's layout.
 */
export function LayerBeneath({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={className === undefined ? boxless : undefined}
      inert
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
